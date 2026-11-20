import type {
  FinancialApplicationScope,
  FinancialChargeKind,
  FinancialIncidenceBase,
} from "@/db/schema/enums";

export const FINANCIAL_CALCULATION_VERSION = "collab-pricing-v1";
export const COMMERCIAL_MARKUP_BASIS_POINTS = 4_000;
export const PARTY_SHARE_BASIS_POINTS = 5_000;
const BASIS_POINTS = BigInt(10_000);
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_TWO = BigInt(2);

export class FinancialCalculationError extends Error {
  constructor(
    readonly code:
      | "INVALID_AMOUNT"
      | "INVALID_RATE"
      | "INCOMPATIBLE_SCOPE"
      | "UNSUPPORTED_GROSS_UP",
    message: string,
  ) {
    super(message);
    this.name = "FinancialCalculationError";
  }
}

export interface FinancialChargeInput {
  id: string;
  kind: FinancialChargeKind;
  percentageBasisPoints: number;
  fixedAmountInCents: number;
  incidenceBase: FinancialIncidenceBase;
  applicationScope: FinancialApplicationScope;
}

function assertCents(value: number, field: string, allowZero = true): void {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > 2_147_483_647
  ) {
    throw new FinancialCalculationError(
      "INVALID_AMOUNT",
      `${field} deve ser informado em centavos inteiros válidos.`,
    );
  }
}

function assertRule(rule: FinancialChargeInput): void {
  assertCents(rule.fixedAmountInCents, "Valor fixo");
  if (
    !Number.isSafeInteger(rule.percentageBasisPoints) ||
    rule.percentageBasisPoints < 0 ||
    rule.percentageBasisPoints >= 10_000
  ) {
    throw new FinancialCalculationError(
      "INVALID_RATE",
      "A alíquota precisa estar entre 0% e 99,99%.",
    );
  }
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BIGINT_TWO) / denominator;
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - BIGINT_ONE) / denominator;
}

function safeNumber(value: bigint): number {
  const result = Number(value);
  assertCents(result, "Resultado");
  return result;
}

export function calculateCommercialSplit(artistCostInCents: number) {
  assertCents(artistCostInCents, "Custo do artista", false);
  const cost = BigInt(artistCostInCents);
  const addition = roundHalfUp(
    cost * BigInt(COMMERCIAL_MARKUP_BASIS_POINTS),
    BASIS_POINTS,
  );
  const owner = addition / BIGINT_TWO;
  const organizer = addition / BIGINT_TWO;
  const residual = addition - owner - organizer;

  return {
    artistCostInCents,
    commercialAdditionInCents: safeNumber(addition),
    ownerShareInCents: safeNumber(owner),
    organizerShareInCents: safeNumber(organizer),
    roundingResidualInCents: safeNumber(residual),
    commercialBaseInCents: safeNumber(cost + addition),
    calculationVersion: FINANCIAL_CALCULATION_VERSION,
  };
}

export function calculateGrossedUpPrice(input: {
  artistCostInCents: number;
  shippingInCents?: number;
  rules: FinancialChargeInput[];
  context: FinancialApplicationScope;
}) {
  const commercial = calculateCommercialSplit(input.artistCostInCents);
  const shippingInCents = input.shippingInCents ?? 0;
  assertCents(shippingInCents, "Frete");
  for (const rule of input.rules) {
    assertRule(rule);
    if (rule.applicationScope !== input.context) {
      throw new FinancialCalculationError(
        "INCOMPATIBLE_SCOPE",
        "Uma regra por pedido não pode ser aplicada como custo por item, ou vice-versa.",
      );
    }
  }

  const commercialBase = BigInt(commercial.commercialBaseInCents);
  const shipping = BigInt(shippingInCents);
  let numerator = commercialBase * BASIS_POINTS;
  let denominator = BASIS_POINTS;

  for (const rule of input.rules) {
    const rate = BigInt(rule.percentageBasisPoints);
    numerator += BigInt(rule.fixedAmountInCents) * BASIS_POINTS;
    switch (rule.incidenceBase) {
      case "commercial_base":
        numerator += commercialBase * rate;
        break;
      case "shipping":
        numerator += shipping * rate;
        break;
      case "final_merchandise":
        denominator -= rate;
        break;
      case "transaction_total":
        denominator -= rate;
        numerator += shipping * rate;
        break;
    }
  }

  if (denominator <= BIGINT_ZERO) {
    throw new FinancialCalculationError(
      "UNSUPPORTED_GROSS_UP",
      "A soma das alíquotas sobre o total inviabiliza o gross-up.",
    );
  }

  const finalMerchandise = ceilDivide(numerator, denominator);
  const calculatedCharges = input.rules.map((rule) => {
    const base =
      rule.incidenceBase === "commercial_base"
        ? commercialBase
        : rule.incidenceBase === "shipping"
          ? shipping
          : rule.incidenceBase === "transaction_total"
            ? finalMerchandise + shipping
            : finalMerchandise;
    const amount =
      BigInt(rule.fixedAmountInCents) +
      roundHalfUp(base * BigInt(rule.percentageBasisPoints), BASIS_POINTS);
    return { ...rule, amountInCents: safeNumber(amount) };
  });
  const paymentFeeInCents = calculatedCharges
    .filter((rule) => rule.kind === "payment_fee")
    .reduce((total, rule) => total + rule.amountInCents, 0);
  const taxInCents = calculatedCharges
    .filter((rule) => rule.kind === "tax")
    .reduce((total, rule) => total + rule.amountInCents, 0);
  const calculationResidualInCents =
    safeNumber(finalMerchandise) -
    commercial.commercialBaseInCents -
    paymentFeeInCents -
    taxInCents;

  return {
    ...commercial,
    shippingInCents,
    paymentFeeInCents,
    taxInCents,
    calculationResidualInCents,
    finalMerchandisePriceInCents: safeNumber(finalMerchandise),
    orderTotalInCents: safeNumber(finalMerchandise + shipping),
    charges: calculatedCharges,
  };
}

export function calculateOrderTotal(input: {
  items: { unitCommercialBaseInCents: number; quantity: number }[];
  shippingInCents: number;
  rules: FinancialChargeInput[];
}) {
  const itemsCommercialBaseInCents = input.items.reduce((total, item) => {
    assertCents(item.unitCommercialBaseInCents, "Preço unitário", false);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new FinancialCalculationError(
        "INVALID_AMOUNT",
        "A quantidade deve ser inteira e positiva.",
      );
    }
    return total + item.unitCommercialBaseInCents * item.quantity;
  }, 0);
  assertCents(itemsCommercialBaseInCents, "Total das mercadorias", false);
  assertCents(input.shippingInCents, "Frete");
  const commercialBase = BigInt(itemsCommercialBaseInCents);
  const shipping = BigInt(input.shippingInCents);
  let numerator = commercialBase * BASIS_POINTS;
  let denominator = BASIS_POINTS;
  for (const rule of input.rules) {
    assertRule(rule);
    if (rule.applicationScope !== "per_order") {
      throw new FinancialCalculationError(
        "INCOMPATIBLE_SCOPE",
        "O cálculo do pedido aceita somente regras aplicadas uma vez por pedido.",
      );
    }
    const rate = BigInt(rule.percentageBasisPoints);
    numerator += BigInt(rule.fixedAmountInCents) * BASIS_POINTS;
    if (rule.incidenceBase === "commercial_base")
      numerator += commercialBase * rate;
    if (rule.incidenceBase === "shipping") numerator += shipping * rate;
    if (rule.incidenceBase === "final_merchandise") denominator -= rate;
    if (rule.incidenceBase === "transaction_total") {
      denominator -= rate;
      numerator += shipping * rate;
    }
  }
  if (denominator <= BIGINT_ZERO) {
    throw new FinancialCalculationError(
      "UNSUPPORTED_GROSS_UP",
      "A soma das alíquotas do pedido inviabiliza o gross-up.",
    );
  }
  const finalMerchandise = ceilDivide(numerator, denominator);
  const charges = input.rules.map((rule) => {
    const base =
      rule.incidenceBase === "commercial_base"
        ? commercialBase
        : rule.incidenceBase === "shipping"
          ? shipping
          : rule.incidenceBase === "transaction_total"
            ? finalMerchandise + shipping
            : finalMerchandise;
    return {
      ...rule,
      amountInCents: safeNumber(
        BigInt(rule.fixedAmountInCents) +
          roundHalfUp(base * BigInt(rule.percentageBasisPoints), BASIS_POINTS),
      ),
    };
  });
  const paymentFeeInCents = charges
    .filter((rule) => rule.kind === "payment_fee")
    .reduce((sum, rule) => sum + rule.amountInCents, 0);
  const taxInCents = charges
    .filter((rule) => rule.kind === "tax")
    .reduce((sum, rule) => sum + rule.amountInCents, 0);
  return {
    itemsCommercialBaseInCents,
    shippingInCents: input.shippingInCents,
    paymentFeeInCents,
    taxInCents,
    calculationResidualInCents:
      safeNumber(finalMerchandise) -
      itemsCommercialBaseInCents -
      paymentFeeInCents -
      taxInCents,
    finalMerchandisePriceInCents: safeNumber(finalMerchandise),
    orderTotalInCents: safeNumber(finalMerchandise + shipping),
    charges,
  };
}

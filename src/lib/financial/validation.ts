import type {
  FinancialApplicationScope,
  FinancialChargeKind,
  FinancialIncidenceBase,
} from "@/db/schema/enums";
import type { AdminFieldErrors } from "@/lib/admin/types";
import { isUuid, parsePriceInCents } from "@/lib/admin/validation";

type Result<T> =
  | { success: true; data: T }
  | { success: false; message: string; fieldErrors: AdminFieldErrors };

export interface FinancialPolicyInput {
  code: string;
  version: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  source: string;
  approve: boolean;
}

export interface FinancialChargeRuleInput {
  kind: FinancialChargeKind;
  name: string;
  paymentMethod: string | null;
  percentageBasisPoints: number;
  fixedAmountInCents: number;
  incidenceBase: FinancialIncidenceBase;
  applicationScope: FinancialApplicationScope;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  source: string;
  approve: boolean;
}

export interface ProductFinancialPricingInput {
  productId: string | null;
  variationId: string | null;
  artistCostInCents: number;
  policyId: string;
  paymentMethod: string;
  paymentFeeRuleId: string | null;
  taxRuleId: string | null;
  isDefault: boolean;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function error(errors: AdminFieldErrors, field: string, message: string) {
  errors[field] = [...(errors[field] ?? []), message];
}

function finish<T>(errors: AdminFieldErrors, data: T): Result<T> {
  return Object.keys(errors).length
    ? {
        success: false,
        message: "Revise os campos indicados.",
        fieldErrors: errors,
      }
    : { success: true, data };
}

function date(value: unknown): Date | null {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parsePercentageToBasisPoints(value: unknown): number | null {
  const normalized = text(value).replace(",", ".");
  if (!/^\d{1,2}(?:\.\d{1,2})?$/u.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return result >= 0 && result < 10_000 ? result : null;
}

export function validateFinancialPolicyInput(
  input: Record<string, unknown>,
): Result<FinancialPolicyInput> {
  const errors: AdminFieldErrors = {};
  const code = text(input.code).toUpperCase();
  const version = Number(text(input.version));
  const effectiveFrom = date(input.effectiveFrom);
  const effectiveUntil = text(input.effectiveUntil)
    ? date(input.effectiveUntil)
    : null;
  const source = text(input.source);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(code))
    error(
      errors,
      "code",
      "Use um código estável em letras, números, hífen ou sublinhado.",
    );
  if (!Number.isInteger(version) || version < 1)
    error(errors, "version", "Informe uma versão inteira positiva.");
  if (!effectiveFrom)
    error(errors, "effectiveFrom", "Informe o início da vigência.");
  if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
    error(errors, "effectiveUntil", "O fim deve ser posterior ao início.");
  if (source.length < 5 || source.length > 2_000)
    error(errors, "source", "Documente a fonte em 5 a 2.000 caracteres.");
  return finish(errors, {
    code,
    version: Number.isInteger(version) ? version : 0,
    effectiveFrom: effectiveFrom ?? new Date(0),
    effectiveUntil,
    source,
    approve: input.approve === "on" || input.approve === true,
  });
}

export function validateFinancialChargeRuleInput(
  input: Record<string, unknown>,
): Result<FinancialChargeRuleInput> {
  const errors: AdminFieldErrors = {};
  const kind = text(input.kind) as FinancialChargeKind;
  const name = text(input.name);
  const paymentMethod = text(input.paymentMethod) || null;
  const percentageBasisPoints = parsePercentageToBasisPoints(input.percentage);
  const fixedAmountInCents = text(input.fixedAmount)
    ? parsePriceInCents(input.fixedAmount)
    : 0;
  const incidenceBase = text(input.incidenceBase) as FinancialIncidenceBase;
  const applicationScope = text(
    input.applicationScope,
  ) as FinancialApplicationScope;
  const effectiveFrom = date(input.effectiveFrom);
  const effectiveUntil = text(input.effectiveUntil)
    ? date(input.effectiveUntil)
    : null;
  const source = text(input.source);
  if (!new Set(["payment_fee", "tax"]).has(kind))
    error(errors, "kind", "Selecione taxa de pagamento ou tributo.");
  if (name.length < 3 || name.length > 160)
    error(errors, "name", "Use entre 3 e 160 caracteres.");
  if (kind === "payment_fee" && !paymentMethod)
    error(errors, "paymentMethod", "Informe a modalidade de pagamento.");
  if (percentageBasisPoints === null)
    error(errors, "percentage", "Informe um percentual entre 0 e 99,99.");
  if (fixedAmountInCents === null)
    error(errors, "fixedAmount", "Informe um valor fixo válido.");
  if (
    kind === "payment_fee" &&
    percentageBasisPoints === 0 &&
    fixedAmountInCents === 0
  )
    error(
      errors,
      "percentage",
      "Uma taxa de pagamento não pode ser totalmente zerada.",
    );
  if (
    !new Set([
      "commercial_base",
      "final_merchandise",
      "shipping",
      "transaction_total",
    ]).has(incidenceBase)
  )
    error(errors, "incidenceBase", "Selecione uma base de incidência válida.");
  if (!new Set(["per_item", "per_order"]).has(applicationScope))
    error(errors, "applicationScope", "Selecione o escopo da cobrança.");
  if (!effectiveFrom)
    error(errors, "effectiveFrom", "Informe o início da vigência.");
  if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
    error(errors, "effectiveUntil", "O fim deve ser posterior ao início.");
  if (source.length < 5 || source.length > 2_000)
    error(errors, "source", "Documente a fonte validada.");
  return finish(errors, {
    kind,
    name,
    paymentMethod,
    percentageBasisPoints: percentageBasisPoints ?? 0,
    fixedAmountInCents: fixedAmountInCents ?? 0,
    incidenceBase,
    applicationScope,
    effectiveFrom: effectiveFrom ?? new Date(0),
    effectiveUntil,
    source,
    approve: input.approve === "on" || input.approve === true,
  });
}

export function validateProductFinancialPricingInput(
  input: Record<string, unknown>,
): Result<ProductFinancialPricingInput> {
  const errors: AdminFieldErrors = {};
  const productId = text(input.productId) || null;
  const variationId = text(input.variationId) || null;
  const artistCostInCents = parsePriceInCents(input.artistCost);
  const policyId = text(input.policyId);
  const paymentMethod = text(input.paymentMethod).toLowerCase();
  const paymentFeeRuleId = text(input.paymentFeeRuleId) || null;
  const taxRuleId = text(input.taxRuleId) || null;
  if (Number(Boolean(productId)) + Number(Boolean(variationId)) !== 1)
    error(errors, "target", "Selecione exatamente um produto ou variação.");
  if (productId && !isUuid(productId))
    error(errors, "productId", "Produto inválido.");
  if (variationId && !isUuid(variationId))
    error(errors, "variationId", "Variação inválida.");
  if (artistCostInCents === null || artistCostInCents < 1)
    error(errors, "artistCost", "Informe um custo positivo em reais.");
  if (!isUuid(policyId))
    error(errors, "policyId", "Selecione uma política aprovada.");
  if (!/^[a-z0-9][a-z0-9_-]{1,59}$/u.test(paymentMethod))
    error(errors, "paymentMethod", "Informe uma modalidade válida.");
  if (paymentFeeRuleId && !isUuid(paymentFeeRuleId))
    error(errors, "paymentFeeRuleId", "Taxa de pagamento inválida.");
  if (taxRuleId && !isUuid(taxRuleId))
    error(errors, "taxRuleId", "Regra tributária inválida.");
  return finish(errors, {
    productId,
    variationId,
    artistCostInCents: artistCostInCents ?? 0,
    policyId,
    paymentMethod,
    paymentFeeRuleId,
    taxRuleId,
    isDefault: input.isDefault === "on" || input.isDefault === true,
  });
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCommercialSplit,
  calculateGrossedUpPrice,
  calculateOrderTotal,
  FinancialCalculationError,
} from "@/lib/financial/calculation";
import { parsePercentageToBasisPoints } from "@/lib/financial/validation";

test("calcula custo de R$ 100, adicional de 40% e divisão 50/50", () => {
  assert.deepEqual(calculateCommercialSplit(10_000), {
    artistCostInCents: 10_000,
    commercialAdditionInCents: 4_000,
    ownerShareInCents: 2_000,
    organizerShareInCents: 2_000,
    roundingResidualInCents: 0,
    commercialBaseInCents: 14_000,
    calculationVersion: "collab-pricing-v1",
  });
});

test("preserva centavo indivisível como resíduo sem favorecer as partes", () => {
  const result = calculateCommercialSplit(3);
  assert.equal(result.commercialAdditionInCents, 1);
  assert.equal(
    result.commercialAdditionInCents,
    result.ownerShareInCents +
      result.organizerShareInCents +
      result.roundingResidualInCents,
  );
  assert.equal(result.ownerShareInCents, result.organizerShareInCents);
});

test("faz gross-up de taxa percentual sobre o preço final", () => {
  const result = calculateGrossedUpPrice({
    artistCostInCents: 10_000,
    context: "per_item",
    rules: [
      {
        id: "payment",
        kind: "payment_fee",
        percentageBasisPoints: 500,
        fixedAmountInCents: 0,
        incidenceBase: "final_merchandise",
        applicationScope: "per_item",
      },
    ],
  });

  assert.equal(result.finalMerchandisePriceInCents, 14_737);
  assert.equal(result.paymentFeeInCents, 737);
  assert.equal(result.commercialBaseInCents, 14_000);
  assert.equal(result.calculationResidualInCents, 0);
});

test("combina taxa fixa, bases diferentes e tributo fora dos 40%", () => {
  const result = calculateGrossedUpPrice({
    artistCostInCents: 10_000,
    shippingInCents: 2_000,
    context: "per_item",
    rules: [
      {
        id: "payment",
        kind: "payment_fee",
        percentageBasisPoints: 300,
        fixedAmountInCents: 100,
        incidenceBase: "transaction_total",
        applicationScope: "per_item",
      },
      {
        id: "tax",
        kind: "tax",
        percentageBasisPoints: 200,
        fixedAmountInCents: 0,
        incidenceBase: "commercial_base",
        applicationScope: "per_item",
      },
    ],
  });

  assert.equal(result.artistCostInCents, 10_000);
  assert.equal(result.commercialAdditionInCents, 4_000);
  assert.equal(
    result.orderTotalInCents,
    result.finalMerchandisePriceInCents + 2_000,
  );
  assert.equal(
    result.finalMerchandisePriceInCents,
    result.commercialBaseInCents +
      result.paymentFeeInCents +
      result.taxInCents +
      result.calculationResidualInCents,
  );
});

test("aplica taxa fixa por pedido uma única vez para vários itens", () => {
  const result = calculateOrderTotal({
    items: [
      { unitCommercialBaseInCents: 14_000, quantity: 2 },
      { unitCommercialBaseInCents: 7_000, quantity: 1 },
    ],
    shippingInCents: 2_500,
    rules: [
      {
        id: "fixed-order",
        kind: "payment_fee",
        percentageBasisPoints: 0,
        fixedAmountInCents: 150,
        incidenceBase: "transaction_total",
        applicationScope: "per_order",
      },
    ],
  });

  assert.equal(result.itemsCommercialBaseInCents, 35_000);
  assert.equal(result.paymentFeeInCents, 150);
  assert.equal(result.orderTotalInCents, 37_650);
});

test("rejeita escopo incompatível, valores negativos e taxas inviáveis", () => {
  assert.throws(
    () =>
      calculateGrossedUpPrice({
        artistCostInCents: -1,
        context: "per_item",
        rules: [],
      }),
    FinancialCalculationError,
  );
  assert.throws(
    () =>
      calculateGrossedUpPrice({
        artistCostInCents: 100,
        context: "per_item",
        rules: [
          {
            id: "order-only",
            kind: "payment_fee",
            percentageBasisPoints: 100,
            fixedAmountInCents: 0,
            incidenceBase: "transaction_total",
            applicationScope: "per_order",
          },
        ],
      }),
    /não pode ser aplicada/iu,
  );
});

test("converte percentuais decimais para basis points sem ponto flutuante", () => {
  assert.equal(parsePercentageToBasisPoints("4,99"), 499);
  assert.equal(parsePercentageToBasisPoints("0"), 0);
  assert.equal(parsePercentageToBasisPoints("100"), null);
  assert.equal(parsePercentageToBasisPoints("1,999"), null);
});

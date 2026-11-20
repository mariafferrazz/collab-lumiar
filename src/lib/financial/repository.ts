import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/db/schema";
import { products } from "@/db/schema/catalog";
import {
  financialAuditEvents,
  financialChargeRules,
  financialPricingPolicies,
  productFinancialCosts,
  productPricingScenarios,
} from "@/db/schema/financial";
import { productVariations } from "@/db/schema/inventory";
import { AdminOperationError } from "@/lib/admin/types";
import {
  calculateCommercialSplit,
  calculateGrossedUpPrice,
  FINANCIAL_CALCULATION_VERSION,
} from "@/lib/financial/calculation";
import type {
  FinancialChargeRuleInput,
  FinancialPolicyInput,
  ProductFinancialPricingInput,
} from "@/lib/financial/validation";

export type FinancialDatabase = PostgresJsDatabase<typeof schema>;

function activeAt() {
  return and(
    eq(financialChargeRules.status, "approved"),
    sql`${financialChargeRules.effectiveFrom} <= now()`,
    or(
      isNull(financialChargeRules.effectiveUntil),
      sql`${financialChargeRules.effectiveUntil} > now()`,
    ),
  );
}

function safeError(error: unknown): AdminOperationError {
  if (error instanceof AdminOperationError) return error;
  return new AdminOperationError(
    "INVALID_INPUT",
    "Não foi possível concluir a operação financeira com segurança.",
  );
}

export async function getFinancialDashboard(database: FinancialDatabase) {
  const [policies, rules, costs, scenarios, recentAudit] = await Promise.all([
    database
      .select({
        total: count(),
        approved: sql<number>`count(*) filter (where ${financialPricingPolicies.status} = 'approved')::integer`,
      })
      .from(financialPricingPolicies),
    database
      .select({
        total: count(),
        approved: sql<number>`count(*) filter (where ${financialChargeRules.status} = 'approved')::integer`,
      })
      .from(financialChargeRules),
    database.select({ total: count() }).from(productFinancialCosts),
    database
      .select({
        total: count(),
        validated: sql<number>`count(*) filter (where ${productPricingScenarios.status} = 'validated')::integer`,
      })
      .from(productPricingScenarios),
    database
      .select()
      .from(financialAuditEvents)
      .orderBy(desc(financialAuditEvents.createdAt))
      .limit(8),
  ]);
  return {
    metrics: {
      policies: policies[0]?.total ?? 0,
      approvedPolicies: policies[0]?.approved ?? 0,
      rules: rules[0]?.total ?? 0,
      approvedRules: rules[0]?.approved ?? 0,
      costs: costs[0]?.total ?? 0,
      scenarios: scenarios[0]?.total ?? 0,
      validatedScenarios: scenarios[0]?.validated ?? 0,
    },
    recentAudit,
  };
}

export function listFinancialPolicies(database: FinancialDatabase) {
  return database
    .select()
    .from(financialPricingPolicies)
    .orderBy(desc(financialPricingPolicies.effectiveFrom));
}

export function listFinancialChargeRules(database: FinancialDatabase) {
  return database
    .select()
    .from(financialChargeRules)
    .orderBy(desc(financialChargeRules.effectiveFrom));
}

export async function createFinancialPolicy(
  database: FinancialDatabase,
  input: FinancialPolicyInput,
  actorUserId: string,
) {
  try {
    return await database.transaction(async (tx) => {
      const rows = await tx
        .insert(financialPricingPolicies)
        .values({
          code: input.code,
          version: input.version,
          effectiveFrom: input.effectiveFrom,
          effectiveUntil: input.effectiveUntil,
          source: input.source,
          status: input.approve ? "approved" : "draft",
          approvedByUserId: input.approve ? actorUserId : null,
          approvedAt: input.approve ? new Date() : null,
        })
        .returning();
      const policy = rows[0];
      if (!policy)
        throw new AdminOperationError("INVALID_INPUT", "Política não criada.");
      await tx.insert(financialAuditEvents).values({
        actorUserId,
        action: input.approve ? "policy.approved" : "policy.created",
        entityType: "financial_pricing_policy",
        entityId: policy.id,
        details: { code: policy.code, version: policy.version },
      });
      return policy;
    });
  } catch (error) {
    throw safeError(error);
  }
}

export async function createFinancialChargeRule(
  database: FinancialDatabase,
  input: FinancialChargeRuleInput,
  actorUserId: string,
) {
  try {
    return await database.transaction(async (tx) => {
      const rows = await tx
        .insert(financialChargeRules)
        .values({
          kind: input.kind,
          name: input.name,
          paymentMethod: input.paymentMethod,
          percentageBasisPoints: input.percentageBasisPoints,
          fixedAmountInCents: input.fixedAmountInCents,
          incidenceBase: input.incidenceBase,
          applicationScope: input.applicationScope,
          effectiveFrom: input.effectiveFrom,
          effectiveUntil: input.effectiveUntil,
          source: input.source,
          status: input.approve ? "approved" : "draft",
          approvedByUserId: input.approve ? actorUserId : null,
          approvedAt: input.approve ? new Date() : null,
        })
        .returning();
      const rule = rows[0];
      if (!rule)
        throw new AdminOperationError("INVALID_INPUT", "Regra não criada.");
      await tx.insert(financialAuditEvents).values({
        actorUserId,
        action: input.approve ? "charge_rule.approved" : "charge_rule.created",
        entityType: "financial_charge_rule",
        entityId: rule.id,
        details: { kind: rule.kind, paymentMethod: rule.paymentMethod },
      });
      return rule;
    });
  } catch (error) {
    throw safeError(error);
  }
}

export async function getProductFinancialPricing(
  database: FinancialDatabase,
  productId: string,
) {
  const costs = await database
    .select({
      cost: productFinancialCosts,
      variationSku: productVariations.sku,
      scenarios: sql<number>`(
        select count(*)::integer from ${productPricingScenarios}
        where ${productPricingScenarios.costId} = ${productFinancialCosts.id}
      )`,
      validatedScenarios: sql<number>`(
        select count(*)::integer from ${productPricingScenarios}
        where ${productPricingScenarios.costId} = ${productFinancialCosts.id}
          and ${productPricingScenarios.status} = 'validated'
      )`,
    })
    .from(productFinancialCosts)
    .leftJoin(
      productVariations,
      eq(productFinancialCosts.variationId, productVariations.id),
    )
    .where(
      or(
        eq(productFinancialCosts.productId, productId),
        eq(productVariations.productId, productId),
      ),
    )
    .orderBy(asc(productVariations.sku));
  return costs;
}

async function readApprovedRule(
  database: FinancialDatabase,
  id: string,
  kind: "payment_fee" | "tax",
) {
  const rows = await database
    .select()
    .from(financialChargeRules)
    .where(
      and(
        eq(financialChargeRules.id, id),
        eq(financialChargeRules.kind, kind),
        activeAt(),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function saveProductFinancialPricing(
  database: FinancialDatabase,
  input: ProductFinancialPricingInput,
  actorUserId: string,
) {
  try {
    const policyRows = await database
      .select()
      .from(financialPricingPolicies)
      .where(
        and(
          eq(financialPricingPolicies.id, input.policyId),
          eq(financialPricingPolicies.status, "approved"),
          sql`${financialPricingPolicies.effectiveFrom} <= now()`,
          or(
            isNull(financialPricingPolicies.effectiveUntil),
            sql`${financialPricingPolicies.effectiveUntil} > now()`,
          ),
        ),
      )
      .limit(1);
    if (!policyRows[0]) {
      throw new AdminOperationError(
        "INVALID_INPUT",
        "A política precisa estar aprovada e vigente.",
      );
    }
    const commercial = calculateCommercialSplit(input.artistCostInCents);
    const paymentRule = input.paymentFeeRuleId
      ? await readApprovedRule(database, input.paymentFeeRuleId, "payment_fee")
      : null;
    const taxRule = input.taxRuleId
      ? await readApprovedRule(database, input.taxRuleId, "tax")
      : null;
    if (input.paymentFeeRuleId && !paymentRule)
      throw new AdminOperationError(
        "INVALID_INPUT",
        "A taxa de pagamento não está aprovada e vigente.",
      );
    if (
      paymentRule?.paymentMethod?.toLowerCase() !==
      input.paymentMethod.toLowerCase()
    ) {
      throw new AdminOperationError(
        "INVALID_INPUT",
        "A modalidade não corresponde à taxa de pagamento selecionada.",
      );
    }
    if (input.taxRuleId && !taxRule)
      throw new AdminOperationError(
        "INVALID_INPUT",
        "A regra tributária não está aprovada e vigente.",
      );

    return await database.transaction(async (tx) => {
      const targetCondition = input.productId
        ? eq(productFinancialCosts.productId, input.productId)
        : eq(productFinancialCosts.variationId, input.variationId as string);
      const existing = await tx
        .select()
        .from(productFinancialCosts)
        .where(targetCondition)
        .limit(1);
      const values = {
        productId: input.productId,
        variationId: input.variationId,
        policyId: input.policyId,
        ...commercial,
      };
      const costRows = existing[0]
        ? await tx
            .update(productFinancialCosts)
            .set(values)
            .where(eq(productFinancialCosts.id, existing[0].id))
            .returning()
        : await tx.insert(productFinancialCosts).values(values).returning();
      const cost = costRows[0];
      if (!cost)
        throw new AdminOperationError("INVALID_INPUT", "Custo não salvo.");

      let scenario = null;
      if (paymentRule && taxRule) {
        const result = calculateGrossedUpPrice({
          artistCostInCents: input.artistCostInCents,
          rules: [paymentRule, taxRule],
          context: "per_item",
        });
        if (input.isDefault) {
          await tx
            .update(productPricingScenarios)
            .set({ isDefault: false })
            .where(
              and(
                eq(productPricingScenarios.costId, cost.id),
                eq(productPricingScenarios.isDefault, true),
              ),
            );
        }
        const scenarioRows = await tx
          .insert(productPricingScenarios)
          .values({
            costId: cost.id,
            paymentMethod: input.paymentMethod,
            paymentFeeRuleId: paymentRule.id,
            taxRuleId: taxRule.id,
            expectedPaymentFeeInCents: result.paymentFeeInCents,
            expectedTaxInCents: result.taxInCents,
            calculationResidualInCents: result.calculationResidualInCents,
            finalMerchandisePriceInCents: result.finalMerchandisePriceInCents,
            status: "pending_validation",
            isDefault: input.isDefault,
            calculationVersion: FINANCIAL_CALCULATION_VERSION,
          })
          .onConflictDoUpdate({
            target: [
              productPricingScenarios.costId,
              productPricingScenarios.paymentMethod,
            ],
            set: {
              paymentFeeRuleId: paymentRule.id,
              taxRuleId: taxRule.id,
              expectedPaymentFeeInCents: result.paymentFeeInCents,
              expectedTaxInCents: result.taxInCents,
              calculationResidualInCents: result.calculationResidualInCents,
              finalMerchandisePriceInCents: result.finalMerchandisePriceInCents,
              status: "pending_validation",
              isDefault: input.isDefault,
              calculationVersion: FINANCIAL_CALCULATION_VERSION,
              validatedAt: null,
              validatedByUserId: null,
            },
          })
          .returning();
        scenario = scenarioRows[0] ?? null;
      }
      await tx.insert(financialAuditEvents).values({
        actorUserId,
        action: scenario ? "pricing.calculated" : "pricing.incomplete",
        entityType: "product_financial_cost",
        entityId: cost.id,
        details: {
          productId: input.productId,
          variationId: input.variationId,
          paymentMethod: input.paymentMethod,
        },
      });
      return { cost, scenario };
    });
  } catch (error) {
    throw safeError(error);
  }
}

export async function validateProductPricingScenario(
  database: FinancialDatabase,
  scenarioId: string,
  actorUserId: string,
) {
  try {
    return await database.transaction(async (tx) => {
      const scenarioRows = await tx
        .select()
        .from(productPricingScenarios)
        .where(eq(productPricingScenarios.id, scenarioId))
        .limit(1);
      const scenario = scenarioRows[0];
      if (
        !scenario?.isDefault ||
        !scenario.paymentFeeRuleId ||
        !scenario.taxRuleId
      ) {
        throw new AdminOperationError(
          "INVALID_INPUT",
          "O cenário padrão está incompleto.",
        );
      }
      const costRows = await tx
        .select()
        .from(productFinancialCosts)
        .where(eq(productFinancialCosts.id, scenario.costId))
        .limit(1);
      const cost = costRows[0];
      if (!cost)
        throw new AdminOperationError("NOT_FOUND", "Custo não encontrado.");
      const policyRows = await tx
        .select({ id: financialPricingPolicies.id })
        .from(financialPricingPolicies)
        .where(
          and(
            eq(financialPricingPolicies.id, cost.policyId),
            eq(financialPricingPolicies.status, "approved"),
            sql`${financialPricingPolicies.effectiveFrom} <= now()`,
            or(
              isNull(financialPricingPolicies.effectiveUntil),
              sql`${financialPricingPolicies.effectiveUntil} > now()`,
            ),
          ),
        )
        .limit(1);
      if (!policyRows[0]) {
        throw new AdminOperationError(
          "INVALID_INPUT",
          "A política comercial não está aprovada e vigente.",
        );
      }
      const [paymentRule, taxRule] = await Promise.all([
        readApprovedRule(database, scenario.paymentFeeRuleId, "payment_fee"),
        readApprovedRule(database, scenario.taxRuleId, "tax"),
      ]);
      if (!paymentRule || !taxRule)
        throw new AdminOperationError(
          "INVALID_INPUT",
          "As regras precisam estar aprovadas e vigentes.",
        );
      if (
        paymentRule.paymentMethod?.toLowerCase() !==
        scenario.paymentMethod.toLowerCase()
      ) {
        throw new AdminOperationError(
          "INVALID_INPUT",
          "A modalidade do cenário diverge da taxa aprovada.",
        );
      }
      const result = calculateGrossedUpPrice({
        artistCostInCents: cost.artistCostInCents,
        rules: [paymentRule, taxRule],
        context: "per_item",
      });
      const rows = await tx
        .update(productPricingScenarios)
        .set({
          expectedPaymentFeeInCents: result.paymentFeeInCents,
          expectedTaxInCents: result.taxInCents,
          calculationResidualInCents: result.calculationResidualInCents,
          finalMerchandisePriceInCents: result.finalMerchandisePriceInCents,
          status: "validated",
          validatedByUserId: actorUserId,
          validatedAt: new Date(),
        })
        .where(eq(productPricingScenarios.id, scenarioId))
        .returning();
      if (cost.productId) {
        await tx
          .update(products)
          .set({ priceInCents: result.finalMerchandisePriceInCents })
          .where(eq(products.id, cost.productId));
      } else if (cost.variationId) {
        await tx
          .update(productVariations)
          .set({ specificPriceInCents: result.finalMerchandisePriceInCents })
          .where(eq(productVariations.id, cost.variationId));
      }
      await tx.insert(financialAuditEvents).values({
        actorUserId,
        action: "pricing.validated",
        entityType: "product_pricing_scenario",
        entityId: scenarioId,
        details: { calculationVersion: FINANCIAL_CALCULATION_VERSION },
      });
      return rows[0];
    });
  } catch (error) {
    throw safeError(error);
  }
}

export async function listPricingScenariosForProduct(
  database: FinancialDatabase,
  productId: string,
) {
  return database
    .select({ scenario: productPricingScenarios, cost: productFinancialCosts })
    .from(productPricingScenarios)
    .innerJoin(
      productFinancialCosts,
      eq(productPricingScenarios.costId, productFinancialCosts.id),
    )
    .leftJoin(
      productVariations,
      eq(productFinancialCosts.variationId, productVariations.id),
    )
    .where(
      or(
        eq(productFinancialCosts.productId, productId),
        eq(productVariations.productId, productId),
      ),
    )
    .orderBy(
      desc(productPricingScenarios.isDefault),
      asc(productPricingScenarios.paymentMethod),
    );
}

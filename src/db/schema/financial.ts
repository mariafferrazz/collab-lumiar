import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "@/db/schema/auth";
import { products } from "@/db/schema/catalog";
import {
  financialApplicationScope,
  financialChargeKind,
  financialConfigurationStatus,
  financialIncidenceBase,
  financialPricingStatus,
} from "@/db/schema/enums";
import { productVariations } from "@/db/schema/inventory";

export const financialPricingPolicies = pgTable(
  "financial_pricing_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    version: integer("version").notNull(),
    commercialMarkupBasisPoints: integer("commercial_markup_basis_points")
      .default(4_000)
      .notNull(),
    ownerShareBasisPoints: integer("owner_share_basis_points")
      .default(5_000)
      .notNull(),
    organizerShareBasisPoints: integer("organizer_share_basis_points")
      .default(5_000)
      .notNull(),
    status: financialConfigurationStatus("status").default("draft").notNull(),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    source: text("source").notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("financial_pricing_policies_code_version_unique").on(
      table.code,
      table.version,
    ),
    check(
      "financial_pricing_policies_fixed_agreement",
      sql`${table.commercialMarkupBasisPoints} = 4000 AND ${table.ownerShareBasisPoints} = 5000 AND ${table.organizerShareBasisPoints} = 5000`,
    ),
    check(
      "financial_pricing_policies_validity",
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    check(
      "financial_pricing_policies_approval_complete",
      sql`${table.status} = 'draft' OR (${table.approvedByUserId} IS NOT NULL AND ${table.approvedAt} IS NOT NULL)`,
    ),
    index("financial_pricing_policies_status_validity_idx").on(
      table.status,
      table.effectiveFrom,
      table.effectiveUntil,
    ),
  ],
);

export const financialChargeRules = pgTable(
  "financial_charge_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: financialChargeKind("kind").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 60 }),
    percentageBasisPoints: integer("percentage_basis_points")
      .default(0)
      .notNull(),
    fixedAmountInCents: integer("fixed_amount_in_cents").default(0).notNull(),
    incidenceBase: financialIncidenceBase("incidence_base").notNull(),
    applicationScope: financialApplicationScope("application_scope").notNull(),
    status: financialConfigurationStatus("status").default("draft").notNull(),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    source: text("source").notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "financial_charge_rules_name_not_blank",
      sql`char_length(btrim(${table.name})) > 0`,
    ),
    check(
      "financial_charge_rules_source_not_blank",
      sql`char_length(btrim(${table.source})) > 0`,
    ),
    check(
      "financial_charge_rules_values_valid",
      sql`${table.percentageBasisPoints} BETWEEN 0 AND 9999 AND ${table.fixedAmountInCents} >= 0 AND (${table.kind} = 'tax' OR ${table.percentageBasisPoints} > 0 OR ${table.fixedAmountInCents} > 0)`,
    ),
    check(
      "financial_charge_rules_payment_method",
      sql`${table.kind} <> 'payment_fee' OR (${table.paymentMethod} IS NOT NULL AND char_length(btrim(${table.paymentMethod})) > 0)`,
    ),
    check(
      "financial_charge_rules_validity",
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    check(
      "financial_charge_rules_approval_complete",
      sql`${table.status} = 'draft' OR (${table.approvedByUserId} IS NOT NULL AND ${table.approvedAt} IS NOT NULL)`,
    ),
    index("financial_charge_rules_lookup_idx").on(
      table.kind,
      table.status,
      table.paymentMethod,
      table.effectiveFrom,
    ),
  ],
);

export const productFinancialCosts = pgTable(
  "product_financial_costs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    variationId: uuid("variation_id").references(() => productVariations.id, {
      onDelete: "restrict",
    }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => financialPricingPolicies.id, { onDelete: "restrict" }),
    artistCostInCents: integer("artist_cost_in_cents").notNull(),
    commercialAdditionInCents: integer(
      "commercial_addition_in_cents",
    ).notNull(),
    ownerShareInCents: integer("owner_share_in_cents").notNull(),
    organizerShareInCents: integer("organizer_share_in_cents").notNull(),
    roundingResidualInCents: integer("rounding_residual_in_cents").notNull(),
    commercialBaseInCents: integer("commercial_base_in_cents").notNull(),
    calculationVersion: varchar("calculation_version", {
      length: 60,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "product_financial_costs_exactly_one_target",
      sql`(${table.productId} IS NULL) <> (${table.variationId} IS NULL)`,
    ),
    check(
      "product_financial_costs_artist_cost_positive",
      sql`${table.artistCostInCents} > 0`,
    ),
    check(
      "product_financial_costs_fixed_agreement",
      sql`${table.commercialAdditionInCents} = ((((${table.artistCostInCents})::bigint * 4000) + 5000) / 10000)::integer AND ${table.ownerShareInCents} = ${table.commercialAdditionInCents} / 2 AND ${table.organizerShareInCents} = ${table.commercialAdditionInCents} / 2 AND ${table.roundingResidualInCents} = ${table.commercialAdditionInCents} - ${table.ownerShareInCents} - ${table.organizerShareInCents}`,
    ),
    check(
      "product_financial_costs_sums_match",
      sql`${table.commercialAdditionInCents} = ${table.ownerShareInCents} + ${table.organizerShareInCents} + ${table.roundingResidualInCents} AND ${table.commercialBaseInCents} = ${table.artistCostInCents} + ${table.commercialAdditionInCents}`,
    ),
    uniqueIndex("product_financial_costs_product_unique")
      .on(table.productId)
      .where(sql`${table.productId} IS NOT NULL`),
    uniqueIndex("product_financial_costs_variation_unique")
      .on(table.variationId)
      .where(sql`${table.variationId} IS NOT NULL`),
  ],
);

export const productPricingScenarios = pgTable(
  "product_pricing_scenarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    costId: uuid("cost_id")
      .notNull()
      .references(() => productFinancialCosts.id, { onDelete: "restrict" }),
    paymentMethod: varchar("payment_method", { length: 60 }).notNull(),
    paymentFeeRuleId: uuid("payment_fee_rule_id").references(
      () => financialChargeRules.id,
      { onDelete: "restrict" },
    ),
    taxRuleId: uuid("tax_rule_id").references(() => financialChargeRules.id, {
      onDelete: "restrict",
    }),
    expectedPaymentFeeInCents: integer("expected_payment_fee_in_cents"),
    expectedTaxInCents: integer("expected_tax_in_cents"),
    calculationResidualInCents: integer("calculation_residual_in_cents"),
    finalMerchandisePriceInCents: integer("final_merchandise_price_in_cents"),
    status: financialPricingStatus("status").default("incomplete").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    calculationVersion: varchar("calculation_version", {
      length: 60,
    }).notNull(),
    validatedByUserId: uuid("validated_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("product_pricing_scenarios_cost_method_unique").on(
      table.costId,
      table.paymentMethod,
    ),
    check(
      "product_pricing_scenarios_method_not_blank",
      sql`char_length(btrim(${table.paymentMethod})) > 0`,
    ),
    check(
      "product_pricing_scenarios_values_nonnegative",
      sql`coalesce(${table.expectedPaymentFeeInCents}, 0) >= 0 AND coalesce(${table.expectedTaxInCents}, 0) >= 0 AND coalesce(${table.finalMerchandisePriceInCents}, 0) >= 0`,
    ),
    check(
      "product_pricing_scenarios_validation_complete",
      sql`${table.status} <> 'validated' OR (${table.paymentFeeRuleId} IS NOT NULL AND ${table.taxRuleId} IS NOT NULL AND ${table.expectedPaymentFeeInCents} IS NOT NULL AND ${table.expectedTaxInCents} IS NOT NULL AND ${table.calculationResidualInCents} IS NOT NULL AND ${table.finalMerchandisePriceInCents} IS NOT NULL AND ${table.validatedByUserId} IS NOT NULL AND ${table.validatedAt} IS NOT NULL)`,
    ),
    uniqueIndex("product_pricing_scenarios_default_cost_unique")
      .on(table.costId)
      .where(sql`${table.isDefault} = true`),
    index("product_pricing_scenarios_status_idx").on(table.status),
  ],
);

export const financialAuditEvents = pgTable(
  "financial_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "financial_audit_events_action_not_blank",
      sql`char_length(btrim(${table.action})) > 0`,
    ),
    check(
      "financial_audit_events_entity_not_blank",
      sql`char_length(btrim(${table.entityType})) > 0`,
    ),
    check(
      "financial_audit_events_details_object",
      sql`jsonb_typeof(${table.details}) = 'object'`,
    ),
    index("financial_audit_events_entity_created_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
);

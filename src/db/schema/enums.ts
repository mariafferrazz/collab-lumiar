import { pgEnum } from "drizzle-orm/pg-core";

export const productPublicationStatus = pgEnum("product_publication_status", [
  "draft",
  "published",
  "archived",
]);

export type ProductPublicationStatus =
  (typeof productPublicationStatus.enumValues)[number];

export const financialConfigurationStatus = pgEnum(
  "financial_configuration_status",
  ["draft", "approved"],
);
export const financialChargeKind = pgEnum("financial_charge_kind", [
  "payment_fee",
  "tax",
]);
export const financialIncidenceBase = pgEnum("financial_incidence_base", [
  "commercial_base",
  "final_merchandise",
  "shipping",
  "transaction_total",
]);
export const financialApplicationScope = pgEnum("financial_application_scope", [
  "per_item",
  "per_order",
]);
export const financialPricingStatus = pgEnum("financial_pricing_status", [
  "incomplete",
  "pending_validation",
  "validated",
]);

export type FinancialChargeKind =
  (typeof financialChargeKind.enumValues)[number];
export type FinancialIncidenceBase =
  (typeof financialIncidenceBase.enumValues)[number];
export type FinancialApplicationScope =
  (typeof financialApplicationScope.enumValues)[number];

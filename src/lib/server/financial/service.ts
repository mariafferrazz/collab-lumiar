import "server-only";

import {
  createFinancialChargeRule,
  createFinancialPolicy,
  getFinancialDashboard,
  getProductFinancialPricing,
  listFinancialChargeRules,
  listFinancialPolicies,
  listPricingScenariosForProduct,
  saveProductFinancialPricing,
  validateProductPricingScenario,
} from "@/lib/financial/repository";
import { database } from "@/lib/server/database";

export const financialService = {
  dashboard: () => getFinancialDashboard(database),
  policies: () => listFinancialPolicies(database),
  rules: () => listFinancialChargeRules(database),
  createPolicy: (
    input: Parameters<typeof createFinancialPolicy>[1],
    actor: string,
  ) => createFinancialPolicy(database, input, actor),
  createRule: (
    input: Parameters<typeof createFinancialChargeRule>[1],
    actor: string,
  ) => createFinancialChargeRule(database, input, actor),
  productPricing: (productId: string) =>
    getProductFinancialPricing(database, productId),
  productScenarios: (productId: string) =>
    listPricingScenariosForProduct(database, productId),
  savePricing: (
    input: Parameters<typeof saveProductFinancialPricing>[1],
    actor: string,
  ) => saveProductFinancialPricing(database, input, actor),
  validateScenario: (id: string, actor: string) =>
    validateProductPricingScenario(database, id, actor),
};

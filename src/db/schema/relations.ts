import { relations } from "drizzle-orm";

import { artists } from "@/db/schema/artists";
import { account, session, user } from "@/db/schema/auth";
import { categories, productCategories, products } from "@/db/schema/catalog";
import { customerAddresses } from "@/db/schema/customers";
import {
  financialAuditEvents,
  financialChargeRules,
  financialPricingPolicies,
  productFinancialCosts,
  productPricingScenarios,
} from "@/db/schema/financial";
import { productVariations } from "@/db/schema/inventory";
import { shippingProfiles } from "@/db/schema/logistics";
import { productImages } from "@/db/schema/media";

export const artistsRelations = relations(artists, ({ many }) => ({
  products: many(products),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  addresses: many(customerAddresses),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const customerAddressesRelations = relations(
  customerAddresses,
  ({ one }) => ({
    user: one(user, {
      fields: [customerAddresses.userId],
      references: [user.id],
    }),
  }),
);

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, { relationName: "categoryHierarchy" }),
  products: many(productCategories),
}));

export const productsRelations = relations(products, ({ many, one }) => ({
  artist: one(artists, {
    fields: [products.artistId],
    references: [artists.id],
  }),
  categories: many(productCategories),
  variations: many(productVariations),
  images: many(productImages),
  shippingProfile: one(shippingProfiles),
}));

export const productCategoriesRelations = relations(
  productCategories,
  ({ one }) => ({
    product: one(products, {
      fields: [productCategories.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [productCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const productVariationsRelations = relations(
  productVariations,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariations.productId],
      references: [products.id],
    }),
    shippingProfile: one(shippingProfiles),
  }),
);

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const shippingProfilesRelations = relations(
  shippingProfiles,
  ({ one }) => ({
    product: one(products, {
      fields: [shippingProfiles.productId],
      references: [products.id],
    }),
    variation: one(productVariations, {
      fields: [shippingProfiles.variationId],
      references: [productVariations.id],
    }),
  }),
);

export const financialPricingPoliciesRelations = relations(
  financialPricingPolicies,
  ({ one, many }) => ({
    approvedBy: one(user, {
      fields: [financialPricingPolicies.approvedByUserId],
      references: [user.id],
    }),
    costs: many(productFinancialCosts),
  }),
);

export const financialChargeRulesRelations = relations(
  financialChargeRules,
  ({ one }) => ({
    approvedBy: one(user, {
      fields: [financialChargeRules.approvedByUserId],
      references: [user.id],
    }),
  }),
);

export const productFinancialCostsRelations = relations(
  productFinancialCosts,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productFinancialCosts.productId],
      references: [products.id],
    }),
    variation: one(productVariations, {
      fields: [productFinancialCosts.variationId],
      references: [productVariations.id],
    }),
    policy: one(financialPricingPolicies, {
      fields: [productFinancialCosts.policyId],
      references: [financialPricingPolicies.id],
    }),
    scenarios: many(productPricingScenarios),
  }),
);

export const productPricingScenariosRelations = relations(
  productPricingScenarios,
  ({ one }) => ({
    cost: one(productFinancialCosts, {
      fields: [productPricingScenarios.costId],
      references: [productFinancialCosts.id],
    }),
    paymentFeeRule: one(financialChargeRules, {
      fields: [productPricingScenarios.paymentFeeRuleId],
      references: [financialChargeRules.id],
      relationName: "scenarioPaymentFeeRule",
    }),
    taxRule: one(financialChargeRules, {
      fields: [productPricingScenarios.taxRuleId],
      references: [financialChargeRules.id],
      relationName: "scenarioTaxRule",
    }),
  }),
);

export const financialAuditEventsRelations = relations(
  financialAuditEvents,
  ({ one }) => ({
    actor: one(user, {
      fields: [financialAuditEvents.actorUserId],
      references: [user.id],
    }),
  }),
);

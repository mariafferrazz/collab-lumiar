import { relations } from "drizzle-orm";

import { artists } from "@/db/schema/artists";
import { categories, productCategories, products } from "@/db/schema/catalog";
import { productVariations } from "@/db/schema/inventory";
import { shippingProfiles } from "@/db/schema/logistics";
import { productImages } from "@/db/schema/media";

export const artistsRelations = relations(artists, ({ many }) => ({
  products: many(products),
}));

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

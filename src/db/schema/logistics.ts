import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products } from "@/db/schema/catalog";
import { productVariations } from "@/db/schema/inventory";

export const shippingProfiles = pgTable(
  "shipping_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    variationId: uuid("variation_id").references(() => productVariations.id, {
      onDelete: "restrict",
    }),
    itemWeightGrams: integer("item_weight_grams").notNull(),
    itemHeightCm: numeric("item_height_cm", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    itemWidthCm: numeric("item_width_cm", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    itemLengthCm: numeric("item_length_cm", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    packageWeightGrams: integer("package_weight_grams").notNull(),
    packageHeightCm: numeric("package_height_cm", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    packageWidthCm: numeric("package_width_cm", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    packageLengthCm: numeric("package_length_cm", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    isFragile: boolean("is_fragile").default(false).notNull(),
    shipsSeparately: boolean("ships_separately").default(false).notNull(),
    unitsPerPackage: integer("units_per_package").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "shipping_profiles_exactly_one_target",
      sql`(${table.productId} IS NULL) <> (${table.variationId} IS NULL)`,
    ),
    check(
      "shipping_profiles_item_measurements_positive",
      sql`${table.itemWeightGrams} > 0
        AND ${table.itemHeightCm} > 0
        AND ${table.itemWidthCm} > 0
        AND ${table.itemLengthCm} > 0`,
    ),
    check(
      "shipping_profiles_package_measurements_positive",
      sql`${table.packageWeightGrams} > 0
        AND ${table.packageHeightCm} > 0
        AND ${table.packageWidthCm} > 0
        AND ${table.packageLengthCm} > 0`,
    ),
    check(
      "shipping_profiles_package_weight_valid",
      sql`${table.packageWeightGrams} >= ${table.itemWeightGrams}`,
    ),
    check(
      "shipping_profiles_units_per_package_positive",
      sql`${table.unitsPerPackage} > 0`,
    ),
    check(
      "shipping_profiles_separate_package_single_unit",
      sql`${table.shipsSeparately} = false OR ${table.unitsPerPackage} = 1`,
    ),
    uniqueIndex("shipping_profiles_product_unique")
      .on(table.productId)
      .where(sql`${table.productId} IS NOT NULL`),
    uniqueIndex("shipping_profiles_variation_unique")
      .on(table.variationId)
      .where(sql`${table.variationId} IS NOT NULL`),
  ],
);

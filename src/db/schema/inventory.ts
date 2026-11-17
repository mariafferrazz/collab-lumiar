import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { products } from "@/db/schema/catalog";

export const productVariations = pgTable(
  "product_variations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 80 }).notNull(),
    color: varchar("color", { length: 80 }),
    size: varchar("size", { length: 80 }),
    characteristics: jsonb("characteristics")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    availableQuantity: integer("available_quantity").default(0).notNull(),
    specificPriceInCents: integer("specific_price_in_cents"),
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("product_variations_sku_unique").on(table.sku),
    check(
      "product_variations_sku_format",
      sql`${table.sku} ~ '^[A-Z0-9][A-Z0-9._-]*$'`,
    ),
    check(
      "product_variations_characteristics_object",
      sql`jsonb_typeof(${table.characteristics}) = 'object'`,
    ),
    check(
      "product_variations_quantity_nonnegative",
      sql`${table.availableQuantity} >= 0`,
    ),
    check(
      "product_variations_price_nonnegative",
      sql`${table.specificPriceInCents} IS NULL OR ${table.specificPriceInCents} >= 0`,
    ),
    index("product_variations_product_active_idx").on(
      table.productId,
      table.isActive,
    ),
    uniqueIndex("product_variations_default_product_unique")
      .on(table.productId)
      .where(sql`${table.isDefault} = true`),
  ],
);

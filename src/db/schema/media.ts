import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { products } from "@/db/schema/catalog";

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    filePath: text("file_path").notNull(),
    altText: varchar("alt_text", { length: 300 }).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("product_images_product_order_unique").on(
      table.productId,
      table.displayOrder,
    ),
    check(
      "product_images_file_path_not_blank",
      sql`char_length(btrim(${table.filePath})) > 0`,
    ),
    check(
      "product_images_alt_text_not_blank",
      sql`char_length(btrim(${table.altText})) > 0`,
    ),
    check(
      "product_images_display_order_nonnegative",
      sql`${table.displayOrder} >= 0`,
    ),
    uniqueIndex("product_images_primary_product_unique")
      .on(table.productId)
      .where(sql`${table.isPrimary} = true`),
  ],
);

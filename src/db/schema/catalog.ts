import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { artists } from "@/db/schema/artists";
import { productPublicationStatus } from "@/db/schema/enums";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    description: text("description"),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("categories_slug_unique").on(table.slug),
    check(
      "categories_name_not_blank",
      sql`char_length(btrim(${table.name})) > 0`,
    ),
    check(
      "categories_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "categories_display_order_nonnegative",
      sql`${table.displayOrder} >= 0`,
    ),
    check(
      "categories_parent_not_self",
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
    index("categories_parent_order_idx").on(table.parentId, table.displayOrder),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    material: text("material"),
    productionTechnique: text("production_technique"),
    characteristics: jsonb("characteristics")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    priceInCents: integer("price_in_cents").notNull(),
    publicationStatus: productPublicationStatus("publication_status")
      .default("draft")
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("products_slug_unique").on(table.slug),
    check(
      "products_name_not_blank",
      sql`char_length(btrim(${table.name})) > 0`,
    ),
    check(
      "products_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "products_characteristics_object",
      sql`jsonb_typeof(${table.characteristics}) = 'object'`,
    ),
    check("products_price_nonnegative", sql`${table.priceInCents} >= 0`),
    check(
      "products_published_fields_complete",
      sql`${table.publicationStatus} <> 'published' OR (
        ${table.publishedAt} IS NOT NULL
        AND ${table.description} IS NOT NULL
        AND char_length(btrim(${table.description})) > 0
        AND ${table.material} IS NOT NULL
        AND char_length(btrim(${table.material})) > 0
        AND ${table.productionTechnique} IS NOT NULL
        AND char_length(btrim(${table.productionTechnique})) > 0
      )`,
    ),
    index("products_artist_idx").on(table.artistId),
    index("products_status_published_idx").on(
      table.publicationStatus,
      table.publishedAt,
    ),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "product_categories_pk",
      columns: [table.productId, table.categoryId],
    }),
    index("product_categories_category_idx").on(table.categoryId),
  ],
);

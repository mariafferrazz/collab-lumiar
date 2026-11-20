import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "@/db/schema/auth";

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 60 }).notNull(),
    recipientName: varchar("recipient_name", { length: 160 }).notNull(),
    postalCode: varchar("postal_code", { length: 8 }).notNull(),
    street: varchar("street", { length: 200 }).notNull(),
    number: varchar("number", { length: 30 }).notNull(),
    complement: varchar("complement", { length: 120 }),
    neighborhood: varchar("neighborhood", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    stateCode: varchar("state_code", { length: 2 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).default("BR").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "customer_addresses_label_not_blank",
      sql`char_length(btrim(${table.label})) > 0`,
    ),
    check(
      "customer_addresses_recipient_name_not_blank",
      sql`char_length(btrim(${table.recipientName})) > 0`,
    ),
    check(
      "customer_addresses_street_not_blank",
      sql`char_length(btrim(${table.street})) > 0`,
    ),
    check(
      "customer_addresses_number_not_blank",
      sql`char_length(btrim(${table.number})) > 0`,
    ),
    check(
      "customer_addresses_neighborhood_not_blank",
      sql`char_length(btrim(${table.neighborhood})) > 0`,
    ),
    check(
      "customer_addresses_city_not_blank",
      sql`char_length(btrim(${table.city})) > 0`,
    ),
    check(
      "customer_addresses_postal_code_format",
      sql`${table.postalCode} ~ '^[0-9]{8}$'`,
    ),
    check(
      "customer_addresses_state_code_format",
      sql`${table.stateCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "customer_addresses_country_code_format",
      sql`${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    index("customer_addresses_user_idx").on(table.userId),
    uniqueIndex("customer_addresses_default_user_unique")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
  ],
);

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artisticName: varchar("artistic_name", { length: 160 }).notNull(),
    biography: text("biography").notNull(),
    photoPath: text("photo_path"),
    instagramHandle: varchar("instagram_handle", { length: 30 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "artists_artistic_name_not_blank",
      sql`char_length(btrim(${table.artisticName})) > 0`,
    ),
    check(
      "artists_biography_not_blank",
      sql`char_length(btrim(${table.biography})) > 0`,
    ),
    check(
      "artists_instagram_handle_format",
      sql`${table.instagramHandle} IS NULL OR ${table.instagramHandle} ~ '^[A-Za-z0-9._]{1,30}$'`,
    ),
    index("artists_active_name_idx").on(table.isActive, table.artisticName),
  ],
);

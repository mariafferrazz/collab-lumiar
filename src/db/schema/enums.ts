import { pgEnum } from "drizzle-orm/pg-core";

export const productPublicationStatus = pgEnum("product_publication_status", [
  "draft",
  "published",
  "archived",
]);

export type ProductPublicationStatus =
  (typeof productPublicationStatus.enumValues)[number];

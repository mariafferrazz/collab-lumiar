import "server-only";

import { sql } from "drizzle-orm";

import {
  getDemoArtistBySegment,
  getDemoCategoryBySlug,
  getDemoProductBySlug,
  listDemoCategories,
  searchDemoArtists,
  searchDemoProducts,
} from "@/lib/catalog/demo-catalog";
import {
  getPersistedActiveArtistBySegment,
  getPersistedProductPreviewById,
  getPersistedPublishedProductBySlug,
  getPersistedVisibleCategoryBySlug,
  listPersistedVisibleCategories,
  searchPersistedActiveArtists,
  searchPersistedPublishedProducts,
} from "@/lib/catalog/public-catalog-repository";
import { resolvePublicCatalogSource } from "@/lib/catalog/source-config";
import type {
  PublicArtistSearchInput,
  PublicProductSearchInput,
} from "@/types/public-catalog";

const EXPECTED_LOCAL_DATABASE_MARKER = "COLLAB_LOCAL_DEVELOPMENT_DATABASE";
let localDatabaseValidation: Promise<void> | undefined;

async function localDatabase() {
  if (resolvePublicCatalogSource(process.env) !== "persisted-local") {
    throw new Error(
      "A consulta persistida foi bloqueada fora do ambiente local explícito.",
    );
  }

  const { database } = await import("@/lib/server/database");
  localDatabaseValidation ??= (async () => {
    const rows = await database.execute<{
      marker: string | null;
      versionNumber: number;
    }>(sql`
      select
        shobj_description(oid, 'pg_database') as marker,
        current_setting('server_version_num')::integer as "versionNumber"
      from pg_database
      where datname = current_database()
    `);
    const observed = rows[0];
    if (
      observed?.marker !== EXPECTED_LOCAL_DATABASE_MARKER ||
      observed.versionNumber < 180_000 ||
      observed.versionNumber >= 190_000
    ) {
      throw new Error(
        "O catálogo foi bloqueado porque o PostgreSQL local não possui a identidade esperada.",
      );
    }
  })();
  await localDatabaseValidation;
  return database;
}

export const publicCatalog = {
  source: () => resolvePublicCatalogSource(process.env),
  searchProducts: async (input: PublicProductSearchInput) => {
    if (resolvePublicCatalogSource(process.env) === "demo") {
      return searchDemoProducts(input);
    }
    return searchPersistedPublishedProducts(await localDatabase(), input);
  },
  productBySlug: async (slug: string) => {
    if (resolvePublicCatalogSource(process.env) === "demo") {
      return getDemoProductBySlug(slug);
    }
    return getPersistedPublishedProductBySlug(await localDatabase(), slug);
  },
  searchArtists: async (input: PublicArtistSearchInput) => {
    if (resolvePublicCatalogSource(process.env) === "demo") {
      return searchDemoArtists(input);
    }
    return searchPersistedActiveArtists(await localDatabase(), input);
  },
  artistBySegment: async (segment: string) => {
    if (resolvePublicCatalogSource(process.env) === "demo") {
      return getDemoArtistBySegment(segment);
    }
    return getPersistedActiveArtistBySegment(await localDatabase(), segment);
  },
  categories: async () => {
    if (resolvePublicCatalogSource(process.env) === "demo") {
      return listDemoCategories();
    }
    return listPersistedVisibleCategories(await localDatabase());
  },
  categoryBySlug: async (slug: string) => {
    if (resolvePublicCatalogSource(process.env) === "demo") {
      return getDemoCategoryBySlug(slug);
    }
    return getPersistedVisibleCategoryBySlug(await localDatabase(), slug);
  },
};

export const adminCatalogPreview = {
  byId: async (id: string) =>
    getPersistedProductPreviewById(await localDatabase(), id),
};

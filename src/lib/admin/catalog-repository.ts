import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/db/schema";
import { artists } from "@/db/schema/artists";
import { categories, productCategories, products } from "@/db/schema/catalog";
import { productVariations } from "@/db/schema/inventory";
import { shippingProfiles } from "@/db/schema/logistics";
import { productImages } from "@/db/schema/media";
import { AdminOperationError } from "@/lib/admin/types";
import type {
  ArtistAdminInput,
  CategoryAdminInput,
  ProductAdminInput,
  ProductImageAdminInput,
  ShippingProfileAdminInput,
  StockAdminInput,
  VariationAdminInput,
} from "@/lib/admin/validation";

export type AdminDatabase = PostgresJsDatabase<typeof schema>;

export interface AdminListInput {
  query: string;
  page: number;
  pageSize: number;
  status: string | null;
}

function databaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    error.cause !== error
  ) {
    return databaseErrorCode(error.cause);
  }

  return undefined;
}

export function toAdminOperationError(error: unknown): AdminOperationError {
  if (error instanceof AdminOperationError) {
    return error;
  }

  switch (databaseErrorCode(error)) {
    case "23505":
      return new AdminOperationError(
        "CONFLICT",
        "Já existe um registro com este slug, SKU, ordem ou vínculo principal.",
      );
    case "23503":
    case "23001":
      return new AdminOperationError(
        "RELATION_PROTECTED",
        "A operação foi bloqueada porque existem registros relacionados.",
      );
    case "23514":
      return new AdminOperationError(
        "INVALID_INPUT",
        "Os dados não atendem às regras de integridade do catálogo.",
      );
    case "40001":
    case "40P01":
      return new AdminOperationError(
        "CONFLICT",
        "Os dados foram alterados por outra operação. Atualize e tente novamente.",
      );
    default:
      return new AdminOperationError(
        "INVALID_INPUT",
        "Não foi possível concluir a operação com segurança.",
      );
  }
}

async function expectExistingId(
  rows: { id: string }[],
  message: string,
): Promise<string> {
  const id = rows[0]?.id;
  if (!id) {
    throw new AdminOperationError("NOT_FOUND", message);
  }
  return id;
}

export async function getAdminDashboard(database: AdminDatabase) {
  const [
    artistTotals,
    productTotals,
    outOfStock,
    categoryTotals,
    recentProducts,
    recentArtists,
    attentionProducts,
  ] = await Promise.all([
    database
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${artists.isActive} = true)::integer`,
      })
      .from(artists),
    database
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${products.publicationStatus} = 'published')::integer`,
        draft: sql<number>`count(*) filter (where ${products.publicationStatus} = 'draft')::integer`,
        archived: sql<number>`count(*) filter (where ${products.publicationStatus} = 'archived')::integer`,
      })
      .from(products),
    database
      .select({ total: count() })
      .from(products)
      .where(
        sql`not exists (
          select 1 from ${productVariations}
          where ${productVariations.productId} = ${products.id}
            and ${productVariations.isActive} = true
            and ${productVariations.availableQuantity} > 0
        )`,
      ),
    database.select({ total: count() }).from(categories),
    database
      .select({
        id: products.id,
        name: products.name,
        status: products.publicationStatus,
        artistName: artists.artisticName,
        createdAt: products.createdAt,
      })
      .from(products)
      .innerJoin(artists, eq(products.artistId, artists.id))
      .orderBy(desc(products.createdAt))
      .limit(5),
    database
      .select({
        id: artists.id,
        name: artists.artisticName,
        isActive: artists.isActive,
        createdAt: artists.createdAt,
      })
      .from(artists)
      .orderBy(desc(artists.createdAt))
      .limit(5),
    database
      .select({
        id: products.id,
        name: products.name,
        status: products.publicationStatus,
        categoryCount: sql<number>`(
          select count(*)::integer from ${productCategories}
          where ${productCategories.productId} = ${products.id}
        )`,
        stock: sql<number>`coalesce((
          select sum(${productVariations.availableQuantity})::integer
          from ${productVariations}
          where ${productVariations.productId} = ${products.id}
            and ${productVariations.isActive} = true
        ), 0)`,
        imageCount: sql<number>`(
          select count(*)::integer from ${productImages}
          where ${productImages.productId} = ${products.id}
        )`,
      })
      .from(products)
      .where(ne(products.publicationStatus, "archived"))
      .orderBy(desc(products.updatedAt))
      .limit(8),
  ]);

  return {
    metrics: {
      artistsTotal: artistTotals[0]?.total ?? 0,
      artistsActive: artistTotals[0]?.active ?? 0,
      productsTotal: productTotals[0]?.total ?? 0,
      productsPublished: productTotals[0]?.published ?? 0,
      productsDraft: productTotals[0]?.draft ?? 0,
      productsArchived: productTotals[0]?.archived ?? 0,
      productsOutOfStock: outOfStock[0]?.total ?? 0,
      categoriesTotal: categoryTotals[0]?.total ?? 0,
    },
    recentProducts,
    recentArtists,
    attentionProducts: attentionProducts.filter(
      (product) =>
        product.status === "draft" ||
        product.categoryCount === 0 ||
        product.stock === 0 ||
        product.imageCount === 0,
    ),
  };
}

export async function listArtists(
  database: AdminDatabase,
  input: AdminListInput,
) {
  const conditions = [
    input.query ? ilike(artists.artisticName, `%${input.query}%`) : undefined,
    input.status === "active"
      ? eq(artists.isActive, true)
      : input.status === "inactive"
        ? eq(artists.isActive, false)
        : undefined,
  ].filter(Boolean);
  const where = and(...conditions);
  const offset = (input.page - 1) * input.pageSize;
  const [rows, totals] = await Promise.all([
    database
      .select({
        id: artists.id,
        artisticName: artists.artisticName,
        instagramHandle: artists.instagramHandle,
        isActive: artists.isActive,
        updatedAt: artists.updatedAt,
        productCount: sql<number>`(
          select count(*)::integer from ${products}
          where ${products.artistId} = ${artists.id}
        )`,
      })
      .from(artists)
      .where(where)
      .orderBy(asc(artists.artisticName))
      .limit(input.pageSize)
      .offset(offset),
    database.select({ total: count() }).from(artists).where(where),
  ]);

  return { rows, total: totals[0]?.total ?? 0 };
}

export async function getArtistDetail(database: AdminDatabase, id: string) {
  const [artistRows, linkedProducts] = await Promise.all([
    database.select().from(artists).where(eq(artists.id, id)).limit(1),
    database
      .select({
        id: products.id,
        name: products.name,
        status: products.publicationStatus,
      })
      .from(products)
      .where(eq(products.artistId, id))
      .orderBy(desc(products.updatedAt)),
  ]);

  const artist = artistRows[0];
  return artist ? { artist, products: linkedProducts } : null;
}

export async function createArtist(
  database: AdminDatabase,
  input: ArtistAdminInput,
) {
  try {
    const rows = await database.insert(artists).values(input).returning();
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function updateArtist(
  database: AdminDatabase,
  id: string,
  input: ArtistAdminInput,
) {
  try {
    const rows = await database
      .update(artists)
      .set(input)
      .where(eq(artists.id, id))
      .returning();
    await expectExistingId(rows, "Artista não encontrado.");
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function setArtistActive(
  database: AdminDatabase,
  id: string,
  isActive: boolean,
) {
  try {
    const rows = await database
      .update(artists)
      .set({ isActive })
      .where(eq(artists.id, id))
      .returning({ id: artists.id });
    await expectExistingId(rows, "Artista não encontrado.");
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function listCategories(
  database: AdminDatabase,
  input: AdminListInput,
) {
  const where = input.query
    ? or(
        ilike(categories.name, `%${input.query}%`),
        ilike(categories.slug, `%${input.query}%`),
      )
    : undefined;
  const offset = (input.page - 1) * input.pageSize;
  const [rows, totals, allCategories] = await Promise.all([
    database
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        parentId: categories.parentId,
        displayOrder: categories.displayOrder,
        productCount: sql<number>`(
          select count(*)::integer from ${productCategories}
          where ${productCategories.categoryId} = ${categories.id}
        )`,
      })
      .from(categories)
      .where(where)
      .orderBy(asc(categories.displayOrder), asc(categories.name))
      .limit(input.pageSize)
      .offset(offset),
    database.select({ total: count() }).from(categories).where(where),
    database
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
  ]);
  const names = new Map(
    allCategories.map((category) => [category.id, category.name]),
  );

  return {
    rows: rows.map((category) => ({
      ...category,
      parentName: category.parentId
        ? (names.get(category.parentId) ?? null)
        : null,
    })),
    total: totals[0]?.total ?? 0,
  };
}

export async function getCategoryDetail(database: AdminDatabase, id: string) {
  const rows = await database
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listCategoryOptions(
  database: AdminDatabase,
  excludeId?: string,
) {
  return database
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(excludeId ? ne(categories.id, excludeId) : undefined)
    .orderBy(asc(categories.displayOrder), asc(categories.name));
}

export async function createCategory(
  database: AdminDatabase,
  input: CategoryAdminInput,
) {
  try {
    const rows = await database.insert(categories).values(input).returning();
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function updateCategory(
  database: AdminDatabase,
  id: string,
  input: CategoryAdminInput,
) {
  try {
    const rows = await database
      .update(categories)
      .set(input)
      .where(eq(categories.id, id))
      .returning();
    await expectExistingId(rows, "Categoria não encontrada.");
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function deleteCategory(database: AdminDatabase, id: string) {
  try {
    await database.transaction(async (tx) => {
      const [links, children] = await Promise.all([
        tx
          .select({ total: count() })
          .from(productCategories)
          .where(eq(productCategories.categoryId, id)),
        tx
          .select({ total: count() })
          .from(categories)
          .where(eq(categories.parentId, id)),
      ]);
      if ((links[0]?.total ?? 0) > 0 || (children[0]?.total ?? 0) > 0) {
        throw new AdminOperationError(
          "RELATION_PROTECTED",
          "A categoria possui produtos ou subcategorias e não pode ser removida.",
        );
      }
      const rows = await tx
        .delete(categories)
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      await expectExistingId(rows, "Categoria não encontrada.");
    });
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function listProducts(
  database: AdminDatabase,
  input: AdminListInput,
) {
  const status = ["draft", "published", "archived"].includes(input.status ?? "")
    ? (input.status as "draft" | "published" | "archived")
    : null;
  const where = and(
    input.query
      ? or(
          ilike(products.name, `%${input.query}%`),
          ilike(products.slug, `%${input.query}%`),
        )
      : undefined,
    status ? eq(products.publicationStatus, status) : undefined,
  );
  const offset = (input.page - 1) * input.pageSize;
  const [rows, totals] = await Promise.all([
    database
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        artistName: artists.artisticName,
        status: products.publicationStatus,
        priceInCents: products.priceInCents,
        updatedAt: products.updatedAt,
        stock: sql<number>`coalesce((
          select sum(${productVariations.availableQuantity})::integer
          from ${productVariations}
          where ${productVariations.productId} = ${products.id}
            and ${productVariations.isActive} = true
        ), 0)`,
      })
      .from(products)
      .innerJoin(artists, eq(products.artistId, artists.id))
      .where(where)
      .orderBy(desc(products.updatedAt))
      .limit(input.pageSize)
      .offset(offset),
    database.select({ total: count() }).from(products).where(where),
  ]);

  return { rows, total: totals[0]?.total ?? 0 };
}

export async function listArtistOptions(database: AdminDatabase) {
  return database
    .select({
      id: artists.id,
      name: artists.artisticName,
      isActive: artists.isActive,
    })
    .from(artists)
    .orderBy(asc(artists.artisticName));
}

export async function getProductDetail(database: AdminDatabase, id: string) {
  const [productRows, categoryRows, variationRows, imageRows, shippingRows] =
    await Promise.all([
      database
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          artistId: products.artistId,
          artistName: artists.artisticName,
          material: products.material,
          productionTechnique: products.productionTechnique,
          characteristics: products.characteristics,
          priceInCents: products.priceInCents,
          publicationStatus: products.publicationStatus,
          publishedAt: products.publishedAt,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .innerJoin(artists, eq(products.artistId, artists.id))
        .where(eq(products.id, id))
        .limit(1),
      database
        .select({ id: categories.id, name: categories.name })
        .from(productCategories)
        .innerJoin(categories, eq(productCategories.categoryId, categories.id))
        .where(eq(productCategories.productId, id))
        .orderBy(asc(categories.name)),
      database
        .select()
        .from(productVariations)
        .where(eq(productVariations.productId, id))
        .orderBy(desc(productVariations.isDefault), asc(productVariations.sku)),
      database
        .select()
        .from(productImages)
        .where(eq(productImages.productId, id))
        .orderBy(asc(productImages.displayOrder)),
      database
        .select({ profile: shippingProfiles })
        .from(shippingProfiles)
        .leftJoin(
          productVariations,
          eq(shippingProfiles.variationId, productVariations.id),
        )
        .where(
          or(
            eq(shippingProfiles.productId, id),
            eq(productVariations.productId, id),
          ),
        ),
    ]);
  const product = productRows[0];
  return product
    ? {
        product,
        categories: categoryRows,
        variations: variationRows,
        images: imageRows,
        shippingProfile:
          shippingRows.find((row) => row.profile.productId === id)?.profile ??
          null,
        variationShippingProfiles: shippingRows
          .map((row) => row.profile)
          .filter((profile) => profile.variationId !== null),
      }
    : null;
}

async function validateProductRelations(
  database: AdminDatabase,
  input: ProductAdminInput,
) {
  const [artistRows, categoryRows] = await Promise.all([
    database
      .select({ id: artists.id })
      .from(artists)
      .where(eq(artists.id, input.artistId))
      .limit(1),
    input.categoryIds.length > 0
      ? database
          .select({ id: categories.id })
          .from(categories)
          .where(inArray(categories.id, input.categoryIds))
      : Promise.resolve([]),
  ]);

  if (!artistRows[0] || categoryRows.length !== input.categoryIds.length) {
    throw new AdminOperationError(
      "INVALID_INPUT",
      "O artista ou uma das categorias não existe.",
    );
  }
}

export async function createProduct(
  database: AdminDatabase,
  input: ProductAdminInput,
) {
  try {
    await validateProductRelations(database, input);
    return await database.transaction(async (tx) => {
      const rows = await tx
        .insert(products)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          artistId: input.artistId,
          material: input.material,
          productionTechnique: input.productionTechnique,
          priceInCents: input.priceInCents,
          publicationStatus: input.publicationStatus,
          publishedAt: null,
        })
        .returning();
      const product = rows[0];
      if (!product) {
        throw new AdminOperationError("INVALID_INPUT", "Produto não criado.");
      }
      if (input.categoryIds.length > 0) {
        await tx.insert(productCategories).values(
          input.categoryIds.map((categoryId) => ({
            productId: product.id,
            categoryId,
          })),
        );
      }
      return product;
    });
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function updateProduct(
  database: AdminDatabase,
  id: string,
  input: ProductAdminInput,
) {
  try {
    await validateProductRelations(database, input);
    return await database.transaction(async (tx) => {
      const rows = await tx
        .update(products)
        .set({
          name: input.name,
          slug: input.slug,
          description: input.description,
          artistId: input.artistId,
          material: input.material,
          productionTechnique: input.productionTechnique,
          priceInCents: input.priceInCents,
          publicationStatus: input.publicationStatus,
          publishedAt: null,
        })
        .where(eq(products.id, id))
        .returning();
      await expectExistingId(rows, "Produto não encontrado.");
      await tx
        .delete(productCategories)
        .where(eq(productCategories.productId, id));
      if (input.categoryIds.length > 0) {
        await tx.insert(productCategories).values(
          input.categoryIds.map((categoryId) => ({
            productId: id,
            categoryId,
          })),
        );
      }
      return rows[0];
    });
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function setProductPublicationStatus(
  database: AdminDatabase,
  id: string,
  status: "published" | "archived" | "draft",
) {
  try {
    await database.transaction(async (tx) => {
      const rows = await tx
        .update(products)
        .set({
          publicationStatus: status,
          publishedAt: status === "published" ? new Date() : null,
        })
        .where(eq(products.id, id))
        .returning({ id: products.id });
      await expectExistingId(rows, "Produto não encontrado.");
    });
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function createVariation(
  database: AdminDatabase,
  input: VariationAdminInput,
) {
  try {
    const rows = await database
      .insert(productVariations)
      .values(input)
      .returning();
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function updateVariation(
  database: AdminDatabase,
  id: string,
  input: VariationAdminInput,
) {
  try {
    const rows = await database
      .update(productVariations)
      .set({
        sku: input.sku,
        color: input.color,
        size: input.size,
        specificPriceInCents: input.specificPriceInCents,
        isActive: input.isActive,
        isDefault: input.isDefault,
      })
      .where(eq(productVariations.id, id))
      .returning();
    await expectExistingId(rows, "Variação não encontrada.");
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function updateVariationStock(
  database: AdminDatabase,
  input: StockAdminInput,
) {
  try {
    return await database.transaction(
      async (tx) => {
        const rows = await tx
          .update(productVariations)
          .set({ availableQuantity: input.availableQuantity })
          .where(
            and(
              eq(productVariations.id, input.variationId),
              eq(
                productVariations.availableQuantity,
                input.expectedAvailableQuantity,
              ),
              sql`floor(extract(epoch from ${productVariations.updatedAt}) * 1000)::bigint = ${input.expectedUpdatedAt.getTime()}`,
            ),
          )
          .returning({
            id: productVariations.id,
            availableQuantity: productVariations.availableQuantity,
            updatedAt: productVariations.updatedAt,
          });
        if (!rows[0]) {
          throw new AdminOperationError(
            "CONFLICT",
            "O estoque mudou desde a abertura da página. Atualize e tente novamente.",
          );
        }
        return rows[0];
      },
      { isolationLevel: "serializable" },
    );
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function listStock(
  database: AdminDatabase,
  input: AdminListInput,
) {
  const where = and(
    input.query
      ? or(
          ilike(products.name, `%${input.query}%`),
          ilike(productVariations.sku, `%${input.query}%`),
        )
      : undefined,
    input.status === "empty"
      ? eq(productVariations.availableQuantity, 0)
      : input.status === "available"
        ? sql`${productVariations.availableQuantity} > 0`
        : undefined,
  );
  const offset = (input.page - 1) * input.pageSize;
  const [rows, totals] = await Promise.all([
    database
      .select({
        id: productVariations.id,
        productId: products.id,
        productName: products.name,
        sku: productVariations.sku,
        color: productVariations.color,
        size: productVariations.size,
        availableQuantity: productVariations.availableQuantity,
        isActive: productVariations.isActive,
        isDefault: productVariations.isDefault,
        updatedAt: productVariations.updatedAt,
      })
      .from(productVariations)
      .innerJoin(products, eq(productVariations.productId, products.id))
      .where(where)
      .orderBy(asc(products.name), asc(productVariations.sku))
      .limit(input.pageSize)
      .offset(offset),
    database
      .select({ total: count() })
      .from(productVariations)
      .innerJoin(products, eq(productVariations.productId, products.id))
      .where(where),
  ]);
  return { rows, total: totals[0]?.total ?? 0 };
}

export async function addProductImageMetadata(
  database: AdminDatabase,
  input: ProductImageAdminInput,
) {
  try {
    const rows = await database.insert(productImages).values(input).returning();
    return rows[0];
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function removeProductImageMetadata(
  database: AdminDatabase,
  id: string,
) {
  try {
    const rows = await database
      .delete(productImages)
      .where(eq(productImages.id, id))
      .returning({ id: productImages.id });
    await expectExistingId(rows, "Imagem não encontrada.");
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

export async function upsertShippingProfile(
  database: AdminDatabase,
  input: ShippingProfileAdminInput,
) {
  try {
    return await database.transaction(async (tx) => {
      const targetCondition = input.productId
        ? eq(shippingProfiles.productId, input.productId)
        : eq(shippingProfiles.variationId, input.variationId as string);
      const existing = await tx
        .select({ id: shippingProfiles.id })
        .from(shippingProfiles)
        .where(targetCondition)
        .limit(1);
      if (existing[0]) {
        const rows = await tx
          .update(shippingProfiles)
          .set(input)
          .where(eq(shippingProfiles.id, existing[0].id))
          .returning();
        return rows[0];
      }
      const rows = await tx.insert(shippingProfiles).values(input).returning();
      return rows[0];
    });
  } catch (error) {
    throw toAdminOperationError(error);
  }
}

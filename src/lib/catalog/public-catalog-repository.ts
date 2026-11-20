import { and, asc, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/db/schema";
import { artists } from "@/db/schema/artists";
import { categories, productCategories, products } from "@/db/schema/catalog";
import { productVariations } from "@/db/schema/inventory";
import { shippingProfiles } from "@/db/schema/logistics";
import { productImages } from "@/db/schema/media";
import type {
  AdminProductPreview,
  PaginatedResult,
  PublicArtist,
  PublicArtistSearchInput,
  PublicCategory,
  PublicProductDetail,
  PublicProductSearchInput,
  PublicProductSummary,
} from "@/types/public-catalog";

type CatalogDatabase = PostgresJsDatabase<typeof schema>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const validatedPublicPrice = sql<number | null>`(
  select pricing."final_merchandise_price_in_cents"
  from "product_financial_costs" costs
  inner join "product_pricing_scenarios" pricing
    on pricing."cost_id" = costs."id"
  where costs."product_id" = "products"."id"
    and pricing."status" = 'validated'
    and pricing."is_default" = true
    and pricing."final_merchandise_price_in_cents" = "products"."price_in_cents"
  limit 1
)`;

const availableProductQuantity = sql<number>`coalesce((
  select sum(variations."available_quantity")::integer
  from "product_variations" variations
  where variations."product_id" = "products"."id"
    and variations."is_active" = true
), 0)`;

function requiredCondition(condition: SQL | undefined): SQL {
  if (!condition) throw new Error("Condição obrigatória do catálogo ausente.");
  return condition;
}

const validPublishedProduct = requiredCondition(
  and(
    eq(products.publicationStatus, "published"),
    eq(artists.isActive, true),
    sql`${products.publishedAt} IS NOT NULL`,
    sql`exists (
      select 1 from "product_categories" product_category
      where product_category."product_id" = "products"."id"
    )`,
    sql`exists (
      select 1 from "product_variations" default_variation
      where default_variation."product_id" = "products"."id"
        and default_variation."is_active" = true
        and default_variation."is_default" = true
    )`,
    sql`exists (
      select 1 from "product_images" primary_image
      where primary_image."product_id" = "products"."id"
        and primary_image."is_primary" = true
    )`,
    sql`${validatedPublicPrice} IS NOT NULL`,
  ),
);

function publicProductSelection() {
  return {
    id: products.id,
    slug: products.slug,
    name: products.name,
    description: products.description,
    priceInCents: validatedPublicPrice,
    artistId: artists.id,
    artistName: artists.artisticName,
    primaryImageAlt: sql<string | null>`(
      select primary_image."alt_text"
      from "product_images" primary_image
      where primary_image."product_id" = "products"."id"
        and primary_image."is_primary" = true
      limit 1
    )`,
    availableQuantity: availableProductQuantity,
    categoryRows: sql<Array<{ id: string; slug: string; name: string }>>`
      coalesce((
        select json_agg(
          json_build_object(
            'id', category."id",
            'slug', category."slug",
            'name', category."name"
          ) order by category."display_order", category."name"
        )
        from "product_categories" product_category
        inner join "categories" category
          on category."id" = product_category."category_id"
        where product_category."product_id" = "products"."id"
      ), '[]'::json)
    `,
  };
}

async function selectPublicProductRows(
  database: CatalogDatabase,
  input: PublicProductSearchInput,
) {
  return database
    .select(publicProductSelection())
    .from(products)
    .innerJoin(artists, eq(products.artistId, artists.id))
    .where(and(...productConditions(input)))
    .orderBy(...productOrder(input))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);
}

type PublicProductRow = Awaited<
  ReturnType<typeof selectPublicProductRows>
>[number];

function shortDescription(description: string | null): string {
  const normalized = description?.trim() ?? "";
  return normalized.length > 150
    ? `${normalized.slice(0, 147).trimEnd()}…`
    : normalized;
}

function mapPublicProductRow(row: PublicProductRow): PublicProductSummary {
  if (row.priceInCents === null) {
    throw new Error("Produto público sem preço validado.");
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: shortDescription(row.description),
    priceInCents: row.priceInCents,
    artist: {
      id: row.artistId,
      pathSegment: row.artistId,
      name: row.artistName,
    },
    categories: row.categoryRows,
    image: {
      src: null,
      alt: row.primaryImageAlt ?? `Imagem de ${row.name} ainda não disponível`,
    },
    availableQuantity: row.availableQuantity,
    source: "persisted-local",
  };
}

function productConditions(input: PublicProductSearchInput): SQL[] {
  const conditions: SQL[] = [validPublishedProduct];
  if (input.query) {
    const pattern = `%${input.query}%`;
    const searchCondition = or(
      ilike(products.name, pattern),
      ilike(artists.artisticName, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (input.artist) {
    conditions.push(
      UUID_PATTERN.test(input.artist)
        ? eq(artists.id, input.artist)
        : sql`false`,
    );
  }
  if (input.category) {
    conditions.push(sql`exists (
      with recursive selected_categories as (
        select selected."id"
        from "categories" selected
        where selected."slug" = ${input.category}
        union all
        select child."id"
        from "categories" child
        inner join selected_categories parent
          on child."parent_id" = parent."id"
      )
      select 1
      from "product_categories" filtered_category
      inner join selected_categories
        on selected_categories."id" = filtered_category."category_id"
      where filtered_category."product_id" = "products"."id"
    )`);
  }
  if (input.availability === "in-stock") {
    conditions.push(sql`${availableProductQuantity} > 0`);
  } else if (input.availability === "out-of-stock") {
    conditions.push(sql`${availableProductQuantity} = 0`);
  }
  return conditions;
}

function productOrder(input: PublicProductSearchInput): SQL[] {
  if (input.sort === "name-asc") {
    return [asc(products.name), asc(products.id)];
  }
  if (input.sort === "name-desc") {
    return [desc(products.name), asc(products.id)];
  }
  if (input.sort === "price-asc") {
    return [
      sql`${validatedPublicPrice} asc`,
      asc(products.name),
      asc(products.id),
    ];
  }
  if (input.sort === "price-desc") {
    return [
      sql`${validatedPublicPrice} desc`,
      asc(products.name),
      asc(products.id),
    ];
  }
  return [desc(products.publishedAt), asc(products.name), asc(products.id)];
}

export async function searchPersistedPublishedProducts(
  database: CatalogDatabase,
  input: PublicProductSearchInput,
): Promise<PaginatedResult<PublicProductSummary>> {
  const conditions = productConditions(input);
  const [rows, totalRows] = await Promise.all([
    selectPublicProductRows(database, input),
    database
      .select({ total: sql<number>`count(*)::integer` })
      .from(products)
      .innerJoin(artists, eq(products.artistId, artists.id))
      .where(and(...conditions)),
  ]);
  const total = totalRows[0]?.total ?? 0;
  return {
    rows: rows.map(mapPublicProductRow),
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / input.pageSize), 1),
  };
}

export async function listPersistedPublishedProducts(
  database: CatalogDatabase,
  options: { limit?: number; offset?: number } = {},
): Promise<PublicProductSummary[]> {
  const pageSize = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const result = await searchPersistedPublishedProducts(database, {
    query: "",
    category: null,
    artist: null,
    availability: "all",
    sort: "newest",
    page: Math.floor(offset / pageSize) + 1,
    pageSize,
  });
  return result.rows;
}

async function readProductRelations(
  database: CatalogDatabase,
  productId: string,
  fallbackPriceInCents: number,
) {
  const [images, variations, logistics] = await Promise.all([
    database
      .select({
        alt: productImages.altText,
        isPrimary: productImages.isPrimary,
      })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.displayOrder), asc(productImages.id)),
    database
      .select({
        id: productVariations.id,
        sku: productVariations.sku,
        color: productVariations.color,
        size: productVariations.size,
        availableQuantity: productVariations.availableQuantity,
        specificPriceInCents: productVariations.specificPriceInCents,
        validatedPriceInCents: sql<number | null>`(
          select pricing."final_merchandise_price_in_cents"
          from "product_financial_costs" costs
          inner join "product_pricing_scenarios" pricing
            on pricing."cost_id" = costs."id"
          where costs."variation_id" = "product_variations"."id"
            and pricing."status" = 'validated'
            and pricing."is_default" = true
            and pricing."final_merchandise_price_in_cents"
              = "product_variations"."specific_price_in_cents"
          limit 1
        )`,
        isDefault: productVariations.isDefault,
      })
      .from(productVariations)
      .where(
        and(
          eq(productVariations.productId, productId),
          eq(productVariations.isActive, true),
        ),
      )
      .orderBy(desc(productVariations.isDefault), asc(productVariations.sku)),
    database
      .select({
        itemWeightGrams: shippingProfiles.itemWeightGrams,
        packageWeightGrams: shippingProfiles.packageWeightGrams,
        packageHeightCm: shippingProfiles.packageHeightCm,
        packageWidthCm: shippingProfiles.packageWidthCm,
        packageLengthCm: shippingProfiles.packageLengthCm,
        isFragile: shippingProfiles.isFragile,
        shipsSeparately: shippingProfiles.shipsSeparately,
      })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.productId, productId))
      .limit(1),
  ]);

  return {
    images: images.map(({ alt }) => ({ src: null, alt })),
    hasPrimaryImage: images.some(({ isPrimary }) => isPrimary),
    hasInvalidVariationPricing: variations.some(
      (variation) =>
        variation.specificPriceInCents !== null &&
        variation.validatedPriceInCents === null,
    ),
    variations: variations.map((variation) => ({
      id: variation.id,
      label:
        [variation.color, variation.size].filter(Boolean).join(" · ") ||
        variation.sku,
      color: variation.color,
      size: variation.size,
      availableQuantity: variation.availableQuantity,
      priceInCents:
        variation.specificPriceInCents === null
          ? fallbackPriceInCents
          : variation.validatedPriceInCents,
      isDefault: variation.isDefault,
    })),
    logistics: logistics[0] ?? null,
  };
}

export async function getPersistedPublishedProductBySlug(
  database: CatalogDatabase,
  slug: string,
): Promise<PublicProductDetail | null> {
  const rows = await database
    .select({
      ...publicProductSelection(),
      material: products.material,
      productionTechnique: products.productionTechnique,
      characteristics: products.characteristics,
    })
    .from(products)
    .innerJoin(artists, eq(products.artistId, artists.id))
    .where(and(validPublishedProduct, eq(products.slug, slug)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const summary = mapPublicProductRow(row);
  const {
    hasPrimaryImage: _hasPrimaryImage,
    hasInvalidVariationPricing: _hasInvalidVariationPricing,
    ...relations
  } = await readProductRelations(database, row.id, summary.priceInCents);
  return {
    ...summary,
    description: row.description ?? "",
    material: row.material ?? "",
    productionTechnique: row.productionTechnique ?? "",
    characteristics: row.characteristics,
    ...relations,
  };
}

function instagramUrl(handle: string | null): string | null {
  return handle ? `https://www.instagram.com/${handle}/` : null;
}

const publicProductCountForArtist = sql<number>`(
  select count(*)::integer
  from "products" counted_product
  where counted_product."artist_id" = "artists"."id"
    and counted_product."publication_status" = 'published'
    and counted_product."published_at" is not null
    and exists (
      select 1 from "product_categories" counted_category
      where counted_category."product_id" = counted_product."id"
    )
    and exists (
      select 1 from "product_variations" counted_variation
      where counted_variation."product_id" = counted_product."id"
        and counted_variation."is_active" = true
        and counted_variation."is_default" = true
    )
    and exists (
      select 1 from "product_images" counted_image
      where counted_image."product_id" = counted_product."id"
        and counted_image."is_primary" = true
    )
    and exists (
      select 1
      from "product_financial_costs" counted_cost
      inner join "product_pricing_scenarios" counted_price
        on counted_price."cost_id" = counted_cost."id"
      where counted_cost."product_id" = counted_product."id"
        and counted_price."status" = 'validated'
        and counted_price."is_default" = true
        and counted_price."final_merchandise_price_in_cents"
          = counted_product."price_in_cents"
    )
)`;

function mapArtistRow(row: {
  id: string;
  name: string;
  biography: string;
  instagramHandle: string | null;
  productCount: number;
}): PublicArtist {
  return {
    id: row.id,
    pathSegment: row.id,
    name: row.name,
    biography: row.biography,
    image: {
      src: null,
      alt: `Fotografia de ${row.name} ainda não disponível`,
    },
    instagramUrl: instagramUrl(row.instagramHandle),
    productCount: row.productCount,
  };
}

export async function searchPersistedActiveArtists(
  database: CatalogDatabase,
  input: PublicArtistSearchInput,
): Promise<PaginatedResult<PublicArtist>> {
  const conditions: SQL[] = [eq(artists.isActive, true)];
  if (input.query) {
    conditions.push(ilike(artists.artisticName, `%${input.query}%`));
  }
  const [rows, totalRows] = await Promise.all([
    database
      .select({
        id: artists.id,
        name: artists.artisticName,
        biography: artists.biography,
        instagramHandle: artists.instagramHandle,
        productCount: publicProductCountForArtist,
      })
      .from(artists)
      .where(and(...conditions))
      .orderBy(asc(artists.artisticName), asc(artists.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    database
      .select({ total: sql<number>`count(*)::integer` })
      .from(artists)
      .where(and(...conditions)),
  ]);
  const total = totalRows[0]?.total ?? 0;
  return {
    rows: rows.map(mapArtistRow),
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / input.pageSize), 1),
  };
}

export async function getPersistedActiveArtistBySegment(
  database: CatalogDatabase,
  segment: string,
): Promise<PublicArtist | null> {
  if (!UUID_PATTERN.test(segment)) return null;
  const rows = await database
    .select({
      id: artists.id,
      name: artists.artisticName,
      biography: artists.biography,
      instagramHandle: artists.instagramHandle,
      productCount: publicProductCountForArtist,
    })
    .from(artists)
    .where(and(eq(artists.id, segment), eq(artists.isActive, true)))
    .limit(1);
  return rows[0] ? mapArtistRow(rows[0]) : null;
}

export async function listPersistedVisibleCategories(
  database: CatalogDatabase,
): Promise<PublicCategory[]> {
  const [categoryRows, productRows] = await Promise.all([
    database
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        parentId: categories.parentId,
        displayOrder: categories.displayOrder,
      })
      .from(categories)
      .orderBy(asc(categories.displayOrder), asc(categories.name)),
    database
      .select({
        categoryId: productCategories.categoryId,
        productId: products.id,
      })
      .from(productCategories)
      .innerJoin(products, eq(productCategories.productId, products.id))
      .innerJoin(artists, eq(products.artistId, artists.id))
      .where(validPublishedProduct),
  ]);

  const byId = new Map(categoryRows.map((category) => [category.id, category]));
  const directProducts = new Map<string, Set<string>>();
  for (const row of productRows) {
    const productsForCategory = directProducts.get(row.categoryId) ?? new Set();
    productsForCategory.add(row.productId);
    directProducts.set(row.categoryId, productsForCategory);
  }

  const subtreeProducts = new Map<string, Set<string>>();
  const collectProducts = (
    categoryId: string,
    visited = new Set<string>(),
  ): Set<string> => {
    if (subtreeProducts.has(categoryId)) {
      return subtreeProducts.get(categoryId) ?? new Set();
    }
    if (visited.has(categoryId)) return new Set();
    const nextVisited = new Set(visited).add(categoryId);
    const collected = new Set(directProducts.get(categoryId) ?? []);
    for (const child of categoryRows) {
      if (child.parentId === categoryId) {
        for (const productId of collectProducts(child.id, nextVisited)) {
          collected.add(productId);
        }
      }
    }
    subtreeProducts.set(categoryId, collected);
    return collected;
  };

  return categoryRows
    .filter((category) => collectProducts(category.id).size > 0)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      parentId: category.parentId,
      parentSlug: category.parentId
        ? (byId.get(category.parentId)?.slug ?? null)
        : null,
      productCount: collectProducts(category.id).size,
    }));
}

export async function getPersistedVisibleCategoryBySlug(
  database: CatalogDatabase,
  slug: string,
): Promise<PublicCategory | null> {
  const visible = await listPersistedVisibleCategories(database);
  return visible.find((category) => category.slug === slug) ?? null;
}

export async function getPersistedProductPreviewById(
  database: CatalogDatabase,
  productId: string,
): Promise<AdminProductPreview | null> {
  if (!UUID_PATTERN.test(productId)) return null;
  const selection = publicProductSelection();
  const rows = await database
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      material: products.material,
      productionTechnique: products.productionTechnique,
      characteristics: products.characteristics,
      publicationStatus: products.publicationStatus,
      validatedPriceInCents: validatedPublicPrice,
      artistId: artists.id,
      artistName: artists.artisticName,
      artistActive: artists.isActive,
      categoryRows: selection.categoryRows,
      primaryImageAlt: selection.primaryImageAlt,
      availableQuantity: availableProductQuantity,
    })
    .from(products)
    .innerJoin(artists, eq(products.artistId, artists.id))
    .where(eq(products.id, productId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const { hasPrimaryImage, hasInvalidVariationPricing, ...relations } =
    await readProductRelations(
      database,
      row.id,
      row.validatedPriceInCents ?? 0,
    );
  const blockers: string[] = [];
  if (!row.artistActive) blockers.push("O artista está inativo.");
  if (!row.description?.trim()) blockers.push("A descrição está ausente.");
  if (!row.material?.trim() || !row.productionTechnique?.trim()) {
    blockers.push("Material ou técnica de produção estão ausentes.");
  }
  if (row.categoryRows.length === 0) {
    blockers.push("Nenhuma categoria foi vinculada.");
  }
  if (!relations.variations.some((variation) => variation.isDefault)) {
    blockers.push("Não existe variação padrão ativa.");
  }
  if (!hasPrimaryImage) blockers.push("Não existe imagem principal.");
  if (row.validatedPriceInCents === null) {
    blockers.push("A precificação pública ainda não foi validada.");
  }
  if (hasInvalidVariationPricing) {
    blockers.push("Uma variação possui preço específico ainda não validado.");
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: shortDescription(row.description),
    description: row.description ?? "",
    material: row.material ?? "",
    productionTechnique: row.productionTechnique ?? "",
    characteristics: row.characteristics,
    priceInCents: row.validatedPriceInCents,
    artist: {
      id: row.artistId,
      pathSegment: row.artistId,
      name: row.artistName,
    },
    categories: row.categoryRows,
    image: {
      src: null,
      alt: row.primaryImageAlt ?? `Imagem de ${row.name} ainda não disponível`,
    },
    availableQuantity: row.availableQuantity,
    source: "persisted-local",
    publicationStatus: row.publicationStatus,
    publicationBlockers: blockers,
    ...relations,
  };
}

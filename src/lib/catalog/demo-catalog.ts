import {
  artists as demoArtists,
  categories as demoCategories,
  products as demoProducts,
  getArtistBySlug,
  getCategoryBySlug,
  getProductBySlug,
} from "@/data/catalog";
import { isSafePublicImageReference } from "@/lib/catalog/source-config";
import type { Product } from "@/types/catalog";
import type {
  PaginatedResult,
  PublicArtist,
  PublicArtistSearchInput,
  PublicCategory,
  PublicProductDetail,
  PublicProductSearchInput,
  PublicProductSummary,
} from "@/types/public-catalog";

function paginate<T>(
  rows: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const total = rows.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(offset, offset + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

function demoImage(image: { src: string; alt: string; position?: string }) {
  return {
    src: isSafePublicImageReference(image.src) ? image.src : null,
    alt: image.alt,
    ...(image.position ? { position: image.position } : {}),
  };
}

function demoCategory(slug: string): PublicCategory | null {
  const category = getCategoryBySlug(slug);
  if (!category) return null;
  return {
    id: `demo-category-${category.slug}`,
    slug: category.slug,
    name: category.name,
    description: category.description,
    parentId: null,
    parentSlug: null,
    productCount: demoProducts.filter(
      (product) => product.categorySlug === category.slug,
    ).length,
  };
}

function demoArtist(slug: string): PublicArtist | null {
  const artist = getArtistBySlug(slug);
  if (!artist) return null;
  return {
    id: `demo-artist-${artist.slug}`,
    pathSegment: artist.slug,
    name: artist.name,
    biography: `${artist.introduction} ${artist.biography}`,
    image: demoImage(artist.image),
    instagramUrl: null,
    productCount: demoProducts.filter(
      (product) => product.artistSlug === artist.slug,
    ).length,
  };
}

function demoProductSummary(product: Product): PublicProductSummary {
  const artist = demoArtist(product.artistSlug);
  const category = demoCategory(product.categorySlug);
  if (!artist || !category) {
    throw new Error("Fixture demonstrativa do catálogo está inconsistente.");
  }

  return {
    id: `demo-product-${product.slug}`,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    priceInCents: product.priceInCents,
    artist: {
      id: artist.id,
      pathSegment: artist.pathSegment,
      name: artist.name,
    },
    categories: [{ id: category.id, slug: category.slug, name: category.name }],
    image: demoImage(product.image),
    availableQuantity: null,
    source: "demo",
  };
}

function compareDemoProducts(
  left: PublicProductSummary,
  right: PublicProductSummary,
  sort: PublicProductSearchInput["sort"],
): number {
  if (sort === "name-asc" || sort === "name-desc") {
    const comparison = left.name.localeCompare(right.name, "pt-BR");
    return sort === "name-desc" ? -comparison : comparison;
  }
  if (sort === "price-asc" || sort === "price-desc") {
    const comparison =
      left.priceInCents - right.priceInCents ||
      left.name.localeCompare(right.name, "pt-BR");
    return sort === "price-desc" ? -comparison : comparison;
  }
  const featuredDifference =
    Number(demoProducts.find((item) => item.slug === right.slug)?.featured) -
    Number(demoProducts.find((item) => item.slug === left.slug)?.featured);
  return featuredDifference || left.name.localeCompare(right.name, "pt-BR");
}

export function searchDemoProducts(
  input: PublicProductSearchInput,
): PaginatedResult<PublicProductSummary> {
  const query = input.query.toLocaleLowerCase("pt-BR");
  const rows = demoProducts
    .map(demoProductSummary)
    .filter((product) => {
      if (
        query &&
        !`${product.name} ${product.artist.name}`
          .toLocaleLowerCase("pt-BR")
          .includes(query)
      ) {
        return false;
      }
      if (
        input.category &&
        !product.categories.some(({ slug }) => slug === input.category)
      ) {
        return false;
      }
      if (
        input.artist &&
        product.artist.pathSegment !== input.artist &&
        product.artist.id !== input.artist
      ) {
        return false;
      }
      return input.availability === "all";
    })
    .sort((left, right) => compareDemoProducts(left, right, input.sort));

  return paginate(rows, input.page, input.pageSize);
}

export function getDemoProductBySlug(slug: string): PublicProductDetail | null {
  const product = getProductBySlug(slug);
  if (!product) return null;
  return {
    ...demoProductSummary(product),
    description: product.description,
    material: product.materials.join(" · "),
    productionTechnique: "Processo artesanal demonstrativo",
    characteristics: { Dimensões: product.dimensions },
    images: product.gallery.map(demoImage),
    variations: product.variations.map((label, index) => ({
      id: `demo-variation-${product.slug}-${index}`,
      label,
      color: null,
      size: null,
      availableQuantity: 0,
      priceInCents: product.priceInCents,
      isDefault: index === 0,
    })),
    logistics: null,
  };
}

export function listDemoCategories(): PublicCategory[] {
  return demoCategories
    .map(({ slug }) => demoCategory(slug))
    .filter((category): category is PublicCategory => Boolean(category));
}

export function getDemoCategoryBySlug(slug: string): PublicCategory | null {
  return demoCategory(slug);
}

export function searchDemoArtists(
  input: PublicArtistSearchInput,
): PaginatedResult<PublicArtist> {
  const query = input.query.toLocaleLowerCase("pt-BR");
  const rows = demoArtists
    .map(({ slug }) => demoArtist(slug))
    .filter((artist): artist is PublicArtist => Boolean(artist))
    .filter((artist) =>
      query
        ? `${artist.name} ${artist.biography}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)
        : true,
    )
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  return paginate(rows, input.page, input.pageSize);
}

export function getDemoArtistBySegment(segment: string): PublicArtist | null {
  return demoArtist(segment);
}

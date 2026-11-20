export type PublicCatalogSource = "demo" | "persisted-local";

export type PublicCatalogImage = {
  src: string | null;
  alt: string;
  position?: string;
};

export type PublicCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentSlug: string | null;
  productCount: number;
};

export type PublicArtist = {
  id: string;
  pathSegment: string;
  name: string;
  biography: string;
  image: PublicCatalogImage;
  instagramUrl: string | null;
  productCount: number;
};

export type PublicProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceInCents: number;
  artist: Pick<PublicArtist, "id" | "pathSegment" | "name">;
  categories: Array<Pick<PublicCategory, "id" | "slug" | "name">>;
  image: PublicCatalogImage;
  availableQuantity: number | null;
  source: PublicCatalogSource;
};

export type PublicProductVariation = {
  id: string;
  label: string;
  color: string | null;
  size: string | null;
  availableQuantity: number;
  priceInCents: number | null;
  isDefault: boolean;
};

export type PublicProductLogistics = {
  itemWeightGrams: number;
  packageWeightGrams: number;
  packageHeightCm: number;
  packageWidthCm: number;
  packageLengthCm: number;
  isFragile: boolean;
  shipsSeparately: boolean;
};

export type PublicProductDetail = PublicProductSummary & {
  description: string;
  material: string;
  productionTechnique: string;
  characteristics: Record<string, unknown>;
  images: PublicCatalogImage[];
  variations: PublicProductVariation[];
  logistics: PublicProductLogistics | null;
};

export type AdminProductPreview = Omit<
  PublicProductDetail,
  "priceInCents" | "source"
> & {
  priceInCents: number | null;
  source: "persisted-local";
  publicationStatus: "draft" | "published" | "archived";
  publicationBlockers: string[];
};

export type PublicProductSort =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc";

export type PublicAvailabilityFilter = "all" | "in-stock" | "out-of-stock";

export type PublicProductSearchInput = {
  query: string;
  category: string | null;
  artist: string | null;
  availability: PublicAvailabilityFilter;
  sort: PublicProductSort;
  page: number;
  pageSize: number;
};

export type PublicArtistSearchInput = {
  query: string;
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

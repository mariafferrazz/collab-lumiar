import type {
  PublicArtistSearchInput,
  PublicAvailabilityFilter,
  PublicProductSearchInput,
  PublicProductSort,
} from "@/types/public-catalog";

const PRODUCT_SORTS = new Set<PublicProductSort>([
  "newest",
  "name-asc",
  "name-desc",
  "price-asc",
  "price-desc",
]);
const AVAILABILITY_FILTERS = new Set<PublicAvailabilityFilter>([
  "all",
  "in-stock",
  "out-of-stock",
]);
const SLUG_OR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$|^[0-9a-f-]{36}$/iu;

function normalizedText(value: unknown, maximumLength = 100): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ").slice(0, maximumLength)
    : "";
}

function normalizedFilter(value: unknown): string | null {
  const candidate = normalizedText(value, 200);
  return candidate && SLUG_OR_ID_PATTERN.test(candidate) ? candidate : null;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readPublicProductSearchInput(input: {
  q?: unknown;
  categoria?: unknown;
  artista?: unknown;
  disponibilidade?: unknown;
  ordem?: unknown;
  pagina?: unknown;
  limite?: unknown;
}): PublicProductSearchInput {
  const requestedSort = normalizedText(input.ordem) as PublicProductSort;
  const requestedAvailability = normalizedText(
    input.disponibilidade,
  ) as PublicAvailabilityFilter;

  return {
    query: normalizedText(input.q),
    category: normalizedFilter(input.categoria),
    artist: normalizedFilter(input.artista),
    availability: AVAILABILITY_FILTERS.has(requestedAvailability)
      ? requestedAvailability
      : "all",
    sort: PRODUCT_SORTS.has(requestedSort) ? requestedSort : "newest",
    page: positiveInteger(input.pagina, 1),
    pageSize: Math.min(positiveInteger(input.limite, 12), 24),
  };
}

export function readPublicArtistSearchInput(input: {
  q?: unknown;
  pagina?: unknown;
  limite?: unknown;
}): PublicArtistSearchInput {
  return {
    query: normalizedText(input.q),
    page: positiveInteger(input.pagina, 1),
    pageSize: Math.min(positiveInteger(input.limite, 12), 24),
  };
}

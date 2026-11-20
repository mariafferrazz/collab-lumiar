import type { ProductPublicationStatus } from "@/db/schema/enums";
import type { AdminFieldErrors } from "@/lib/admin/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/u;
const INSTAGRAM_PATTERN = /^[A-Za-z0-9._]{1,30}$/u;
const STORAGE_PATH_PATTERN =
  /^catalog\/[0-9a-f-]{36}\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:avif|jpe?g|png|webp)$/iu;

export type AdminValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; fieldErrors: AdminFieldErrors };

export interface ArtistAdminInput {
  artisticName: string;
  biography: string;
  photoPath: string | null;
  instagramHandle: string | null;
  isActive: boolean;
}

export interface CategoryAdminInput {
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  displayOrder: number;
}

export interface ProductAdminInput {
  name: string;
  slug: string;
  description: string | null;
  artistId: string;
  categoryIds: string[];
  material: string | null;
  productionTechnique: string | null;
  priceInCents: number;
  publicationStatus: ProductPublicationStatus;
}

export interface VariationAdminInput {
  productId: string;
  sku: string;
  color: string | null;
  size: string | null;
  availableQuantity: number;
  specificPriceInCents: number | null;
  isActive: boolean;
  isDefault: boolean;
}

export interface StockAdminInput {
  variationId: string;
  availableQuantity: number;
  expectedAvailableQuantity: number;
  expectedUpdatedAt: Date;
}

export interface ProductImageAdminInput {
  productId: string;
  filePath: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ShippingProfileAdminInput {
  productId: string | null;
  variationId: string | null;
  itemWeightGrams: number;
  itemHeightCm: number;
  itemWidthCm: number;
  itemLengthCm: number;
  packageWeightGrams: number;
  packageHeightCm: number;
  packageWidthCm: number;
  packageLengthCm: number;
  isFragile: boolean;
  shipsSeparately: boolean;
  unitsPerPackage: number;
}

function compactText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}

function optionalText(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function addError(
  errors: AdminFieldErrors,
  field: string,
  message: string,
): void {
  errors[field] = [...(errors[field] ?? []), message];
}

function finishValidation<T>(
  errors: AdminFieldErrors,
  data: T,
): AdminValidationResult<T> {
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: "Revise os campos indicados.",
      fieldErrors: errors,
    };
  }

  return { success: true, data };
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function parsePriceInCents(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,9})(?:[,.](\d{1,2}))?$/u);
  if (!match) {
    return null;
  }

  const integerPart = Number(match[1]);
  const decimalPart = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const cents = integerPart * 100 + decimalPart;
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : null;
}

export function formatPriceInput(cents: number | null): string {
  if (cents === null) {
    return "";
  }

  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

function parseNonnegativeInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/u.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647
    ? parsed
    : null;
}

function parsePositiveDecimal(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,6}(?:\.\d{1,2})?$/u.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return parsed > 0 && parsed <= 999_999.99 ? parsed : null;
}

export function validateArtistAdminInput(input: {
  artisticName: unknown;
  biography: unknown;
  photoPath?: unknown;
  instagramHandle?: unknown;
  isActive?: unknown;
}): AdminValidationResult<ArtistAdminInput> {
  const errors: AdminFieldErrors = {};
  const artisticName = compactText(input.artisticName);
  const biography = optionalText(input.biography) ?? "";
  const photoPath = optionalText(input.photoPath);
  const rawInstagram = optionalText(input.instagramHandle);
  const instagramHandle = rawInstagram?.replace(/^@/u, "") ?? null;

  if (artisticName.length < 2 || artisticName.length > 160) {
    addError(errors, "artisticName", "Use entre 2 e 160 caracteres.");
  }
  if (biography.length < 10 || biography.length > 5_000) {
    addError(errors, "biography", "Use entre 10 e 5.000 caracteres.");
  }
  if (photoPath && !STORAGE_PATH_PATTERN.test(photoPath)) {
    addError(errors, "photoPath", "O caminho da imagem não é autorizado.");
  }
  if (instagramHandle && !INSTAGRAM_PATTERN.test(instagramHandle)) {
    addError(errors, "instagramHandle", "Informe somente o nome do perfil.");
  }

  return finishValidation(errors, {
    artisticName,
    biography,
    photoPath,
    instagramHandle,
    isActive: input.isActive === true || input.isActive === "on",
  });
}

export function validateCategoryAdminInput(input: {
  name: unknown;
  slug?: unknown;
  description?: unknown;
  parentId?: unknown;
  displayOrder?: unknown;
  currentId?: string;
}): AdminValidationResult<CategoryAdminInput> {
  const errors: AdminFieldErrors = {};
  const name = compactText(input.name);
  const slug = normalizeSlug(optionalText(input.slug) ?? name);
  const description = optionalText(input.description);
  const parentId = optionalText(input.parentId);
  const displayOrder = parseNonnegativeInteger(
    typeof input.displayOrder === "string" && input.displayOrder.trim()
      ? input.displayOrder
      : "0",
  );

  if (name.length < 2 || name.length > 120) {
    addError(errors, "name", "Use entre 2 e 120 caracteres.");
  }
  if (!SLUG_PATTERN.test(slug) || slug.length > 160) {
    addError(
      errors,
      "slug",
      "Use um slug válido com letras, números e hífens.",
    );
  }
  if (description && description.length > 2_000) {
    addError(errors, "description", "Use no máximo 2.000 caracteres.");
  }
  if (parentId && !isUuid(parentId)) {
    addError(errors, "parentId", "Selecione uma categoria principal válida.");
  }
  if (parentId && parentId === input.currentId) {
    addError(errors, "parentId", "Uma categoria não pode ser pai de si mesma.");
  }
  if (displayOrder === null) {
    addError(errors, "displayOrder", "Informe uma ordem inteira não negativa.");
  }

  return finishValidation(errors, {
    name,
    slug,
    description,
    parentId,
    displayOrder: displayOrder ?? 0,
  });
}

export function validateProductAdminInput(input: {
  name: unknown;
  slug?: unknown;
  description?: unknown;
  artistId: unknown;
  categoryIds?: unknown[];
  material?: unknown;
  productionTechnique?: unknown;
  price?: unknown;
  publicationStatus?: unknown;
}): AdminValidationResult<ProductAdminInput> {
  const errors: AdminFieldErrors = {};
  const name = compactText(input.name);
  const slug = normalizeSlug(optionalText(input.slug) ?? name);
  const description = optionalText(input.description);
  const artistId = compactText(input.artistId);
  const categoryIds = Array.from(
    new Set(
      (input.categoryIds ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  const material = optionalText(input.material);
  const productionTechnique = optionalText(input.productionTechnique);
  const priceInCents = parsePriceInCents(input.price);
  const status = input.publicationStatus;
  const publicationStatus: ProductPublicationStatus =
    status === "archived" ? "archived" : "draft";

  if (name.length < 2 || name.length > 180) {
    addError(errors, "name", "Use entre 2 e 180 caracteres.");
  }
  if (!SLUG_PATTERN.test(slug) || slug.length > 200) {
    addError(
      errors,
      "slug",
      "Use um slug válido com letras, números e hífens.",
    );
  }
  if (description && description.length > 10_000) {
    addError(errors, "description", "Use no máximo 10.000 caracteres.");
  }
  if (!isUuid(artistId)) {
    addError(errors, "artistId", "Selecione um artista válido.");
  }
  if (categoryIds.some((id) => !isUuid(id))) {
    addError(errors, "categoryIds", "Selecione somente categorias válidas.");
  }
  if (priceInCents === null) {
    addError(errors, "price", "Informe um preço válido em reais.");
  }

  return finishValidation(errors, {
    name,
    slug,
    description,
    artistId,
    categoryIds,
    material,
    productionTechnique,
    priceInCents: priceInCents ?? 0,
    publicationStatus,
  });
}

export function validateVariationAdminInput(input: {
  productId: unknown;
  sku: unknown;
  color?: unknown;
  size?: unknown;
  availableQuantity?: unknown;
  specificPrice?: unknown;
  isActive?: unknown;
  isDefault?: unknown;
}): AdminValidationResult<VariationAdminInput> {
  const errors: AdminFieldErrors = {};
  const productId = compactText(input.productId);
  const sku = compactText(input.sku).toUpperCase();
  const color = optionalText(input.color);
  const size = optionalText(input.size);
  const availableQuantity = parseNonnegativeInteger(input.availableQuantity);
  const rawSpecificPrice = optionalText(input.specificPrice);
  const specificPriceInCents = rawSpecificPrice
    ? parsePriceInCents(rawSpecificPrice)
    : null;

  if (!isUuid(productId)) {
    addError(errors, "productId", "Produto inválido.");
  }
  if (!SKU_PATTERN.test(sku) || sku.length > 80) {
    addError(
      errors,
      "sku",
      "Use SKU em letras maiúsculas, números, ponto, hífen ou sublinhado.",
    );
  }
  if (color && color.length > 80) {
    addError(errors, "color", "Use no máximo 80 caracteres.");
  }
  if (size && size.length > 80) {
    addError(errors, "size", "Use no máximo 80 caracteres.");
  }
  if (availableQuantity === null) {
    addError(
      errors,
      "availableQuantity",
      "Informe um estoque inteiro não negativo.",
    );
  }
  if (rawSpecificPrice && specificPriceInCents === null) {
    addError(errors, "specificPrice", "Informe um preço específico válido.");
  }

  return finishValidation(errors, {
    productId,
    sku,
    color,
    size,
    availableQuantity: availableQuantity ?? 0,
    specificPriceInCents,
    isActive: input.isActive === true || input.isActive === "on",
    isDefault: input.isDefault === true || input.isDefault === "on",
  });
}

export function validateStockAdminInput(input: {
  variationId: unknown;
  availableQuantity: unknown;
  expectedAvailableQuantity: unknown;
  expectedUpdatedAt: unknown;
}): AdminValidationResult<StockAdminInput> {
  const errors: AdminFieldErrors = {};
  const variationId = compactText(input.variationId);
  const availableQuantity = parseNonnegativeInteger(input.availableQuantity);
  const expectedAvailableQuantity = parseNonnegativeInteger(
    input.expectedAvailableQuantity,
  );
  const expectedUpdatedAt = new Date(compactText(input.expectedUpdatedAt));

  if (!isUuid(variationId)) {
    addError(errors, "variationId", "Variação inválida.");
  }
  if (availableQuantity === null) {
    addError(
      errors,
      "availableQuantity",
      "Informe uma quantidade inteira não negativa.",
    );
  }
  if (expectedAvailableQuantity === null) {
    addError(
      errors,
      "expectedAvailableQuantity",
      "Atualize a página e tente novamente.",
    );
  }
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    addError(
      errors,
      "expectedUpdatedAt",
      "Atualize a página e tente novamente.",
    );
  }

  return finishValidation(errors, {
    variationId,
    availableQuantity: availableQuantity ?? 0,
    expectedAvailableQuantity: expectedAvailableQuantity ?? 0,
    expectedUpdatedAt,
  });
}

export function validateProductImageAdminInput(input: {
  productId: unknown;
  filePath: unknown;
  altText: unknown;
  displayOrder: unknown;
  isPrimary?: unknown;
}): AdminValidationResult<ProductImageAdminInput> {
  const errors: AdminFieldErrors = {};
  const productId = compactText(input.productId);
  const filePath = compactText(input.filePath);
  const altText = compactText(input.altText);
  const displayOrder = parseNonnegativeInteger(input.displayOrder);

  if (!isUuid(productId)) {
    addError(errors, "productId", "Produto inválido.");
  }
  if (!STORAGE_PATH_PATTERN.test(filePath) || filePath.includes("..")) {
    addError(errors, "filePath", "O caminho da imagem não é autorizado.");
  }
  if (altText.length < 3 || altText.length > 300) {
    addError(errors, "altText", "Use entre 3 e 300 caracteres.");
  }
  if (displayOrder === null) {
    addError(errors, "displayOrder", "Informe uma ordem inteira não negativa.");
  }

  return finishValidation(errors, {
    productId,
    filePath,
    altText,
    displayOrder: displayOrder ?? 0,
    isPrimary: input.isPrimary === true || input.isPrimary === "on",
  });
}

export function validateShippingProfileAdminInput(input: {
  productId?: unknown;
  variationId?: unknown;
  itemWeightGrams: unknown;
  itemHeightCm: unknown;
  itemWidthCm: unknown;
  itemLengthCm: unknown;
  packageWeightGrams: unknown;
  packageHeightCm: unknown;
  packageWidthCm: unknown;
  packageLengthCm: unknown;
  isFragile?: unknown;
  shipsSeparately?: unknown;
  unitsPerPackage: unknown;
}): AdminValidationResult<ShippingProfileAdminInput> {
  const errors: AdminFieldErrors = {};
  const productId = optionalText(input.productId);
  const variationId = optionalText(input.variationId);
  const itemWeightGrams = parseNonnegativeInteger(input.itemWeightGrams);
  const itemHeightCm = parsePositiveDecimal(input.itemHeightCm);
  const itemWidthCm = parsePositiveDecimal(input.itemWidthCm);
  const itemLengthCm = parsePositiveDecimal(input.itemLengthCm);
  const packageWeightGrams = parseNonnegativeInteger(input.packageWeightGrams);
  const packageHeightCm = parsePositiveDecimal(input.packageHeightCm);
  const packageWidthCm = parsePositiveDecimal(input.packageWidthCm);
  const packageLengthCm = parsePositiveDecimal(input.packageLengthCm);
  const unitsPerPackage = parseNonnegativeInteger(input.unitsPerPackage);
  const shipsSeparately =
    input.shipsSeparately === true || input.shipsSeparately === "on";

  if (Number(Boolean(productId)) + Number(Boolean(variationId)) !== 1) {
    addError(
      errors,
      "target",
      "Selecione exatamente um produto ou uma variação.",
    );
  }
  if (productId && !isUuid(productId)) {
    addError(errors, "productId", "Produto inválido.");
  }
  if (variationId && !isUuid(variationId)) {
    addError(errors, "variationId", "Variação inválida.");
  }
  const measurements = {
    itemWeightGrams,
    itemHeightCm,
    itemWidthCm,
    itemLengthCm,
    packageWeightGrams,
    packageHeightCm,
    packageWidthCm,
    packageLengthCm,
  };
  for (const [field, value] of Object.entries(measurements)) {
    if (value === null || value <= 0) {
      addError(errors, field, "Informe um valor positivo válido.");
    }
  }
  if (
    itemWeightGrams !== null &&
    packageWeightGrams !== null &&
    packageWeightGrams < itemWeightGrams
  ) {
    addError(
      errors,
      "packageWeightGrams",
      "A embalagem não pode pesar menos que o item.",
    );
  }
  if (unitsPerPackage === null || unitsPerPackage < 1) {
    addError(
      errors,
      "unitsPerPackage",
      "Informe ao menos uma unidade por embalagem.",
    );
  }
  if (shipsSeparately && unitsPerPackage !== 1) {
    addError(
      errors,
      "unitsPerPackage",
      "Envio separado exige uma unidade por embalagem.",
    );
  }

  return finishValidation(errors, {
    productId,
    variationId,
    itemWeightGrams: itemWeightGrams ?? 0,
    itemHeightCm: itemHeightCm ?? 0,
    itemWidthCm: itemWidthCm ?? 0,
    itemLengthCm: itemLengthCm ?? 0,
    packageWeightGrams: packageWeightGrams ?? 0,
    packageHeightCm: packageHeightCm ?? 0,
    packageWidthCm: packageWidthCm ?? 0,
    packageLengthCm: packageLengthCm ?? 0,
    isFragile: input.isFragile === true || input.isFragile === "on",
    shipsSeparately,
    unitsPerPackage: unitsPerPackage ?? 0,
  });
}

export function readAdminListParameters(input: {
  query?: string;
  page?: string;
  status?: string;
}) {
  const query = compactText(input.query).slice(0, 120);
  const parsedPage = Number(input.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const status = optionalText(input.status);

  return { query, page, pageSize: 20, status };
}

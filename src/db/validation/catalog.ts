export interface CategoryNode {
  id: string;
  parentId: string | null;
}

export interface InventoryVariation {
  sku: string;
  availableQuantity: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface PublishableProduct {
  priceInCents: number;
  description: string | null;
  material: string | null;
  productionTechnique: string | null;
  publishedAt: Date | null;
  categoryCount: number;
  primaryImageCount: number;
  variations: InventoryVariation[];
}

export interface ShippingProfileInput {
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
  shipsSeparately: boolean;
  unitsPerPackage: number;
}

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;

function isNonBlank(value: string | null): value is string {
  return Boolean(value?.trim());
}

export function hasCategoryCycle(categories: CategoryNode[]): boolean {
  const parentById = new Map(
    categories.map((category) => [category.id, category.parentId]),
  );

  for (const category of categories) {
    const visited = new Set<string>();
    let currentId: string | null = category.id;

    while (currentId) {
      if (visited.has(currentId)) {
        return true;
      }

      visited.add(currentId);
      currentId = parentById.get(currentId) ?? null;
    }
  }

  return false;
}

export function hasValidVariationInventory(
  variations: InventoryVariation[],
): boolean {
  const normalizedSkus = new Set<string>();
  let defaultCount = 0;
  let activeDefaultCount = 0;

  for (const variation of variations) {
    if (
      !SKU_PATTERN.test(variation.sku) ||
      !Number.isInteger(variation.availableQuantity) ||
      variation.availableQuantity < 0 ||
      normalizedSkus.has(variation.sku)
    ) {
      return false;
    }

    normalizedSkus.add(variation.sku);

    if (variation.isDefault) {
      defaultCount += 1;
    }

    if (variation.isActive && variation.isDefault) {
      activeDefaultCount += 1;
    }
  }

  return defaultCount === 1 && activeDefaultCount === 1;
}

export function canPublishProduct(product: PublishableProduct): boolean {
  return (
    Number.isInteger(product.priceInCents) &&
    product.priceInCents >= 0 &&
    isNonBlank(product.description) &&
    isNonBlank(product.material) &&
    isNonBlank(product.productionTechnique) &&
    product.publishedAt instanceof Date &&
    !Number.isNaN(product.publishedAt.getTime()) &&
    Number.isInteger(product.categoryCount) &&
    product.categoryCount > 0 &&
    product.primaryImageCount === 1 &&
    hasValidVariationInventory(product.variations)
  );
}

export function hasValidShippingProfile(
  profile: ShippingProfileInput,
): boolean {
  const targetCount =
    Number(Boolean(profile.productId)) + Number(Boolean(profile.variationId));
  const measurements = [
    profile.itemWeightGrams,
    profile.itemHeightCm,
    profile.itemWidthCm,
    profile.itemLengthCm,
    profile.packageWeightGrams,
    profile.packageHeightCm,
    profile.packageWidthCm,
    profile.packageLengthCm,
  ];

  return (
    targetCount === 1 &&
    measurements.every(
      (measurement) => Number.isFinite(measurement) && measurement > 0,
    ) &&
    Number.isInteger(profile.itemWeightGrams) &&
    Number.isInteger(profile.packageWeightGrams) &&
    profile.packageWeightGrams >= profile.itemWeightGrams &&
    Number.isInteger(profile.unitsPerPackage) &&
    profile.unitsPerPackage > 0 &&
    (!profile.shipsSeparately || profile.unitsPerPackage === 1)
  );
}

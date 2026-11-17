import assert from "node:assert/strict";
import test from "node:test";

import {
  canPublishProduct,
  hasCategoryCycle,
  hasValidShippingProfile,
  hasValidVariationInventory,
  type InventoryVariation,
  type PublishableProduct,
  type ShippingProfileInput,
} from "@/db/validation/catalog";

const defaultVariation: InventoryVariation = {
  sku: "COLLAB-001",
  availableQuantity: 3,
  isActive: true,
  isDefault: true,
};

const publishableProduct: PublishableProduct = {
  priceInCents: 12_000,
  description: "Peça produzida artesanalmente.",
  material: "Cerâmica",
  productionTechnique: "Modelagem manual",
  publishedAt: new Date("2026-11-17T12:00:00.000Z"),
  categoryCount: 1,
  primaryImageCount: 1,
  variations: [defaultVariation],
};

const shippingProfile: ShippingProfileInput = {
  productId: "product-id",
  variationId: null,
  itemWeightGrams: 500,
  itemHeightCm: 10,
  itemWidthCm: 12,
  itemLengthCm: 14,
  packageWeightGrams: 650,
  packageHeightCm: 13,
  packageWidthCm: 15,
  packageLengthCm: 17,
  shipsSeparately: false,
  unitsPerPackage: 2,
};

test("aceita hierarquia de categorias sem ciclos", () => {
  assert.equal(
    hasCategoryCycle([
      { id: "root", parentId: null },
      { id: "child", parentId: "root" },
      { id: "grandchild", parentId: "child" },
    ]),
    false,
  );
});

test("detecta ciclos diretos e indiretos entre categorias", () => {
  assert.equal(hasCategoryCycle([{ id: "self", parentId: "self" }]), true);
  assert.equal(
    hasCategoryCycle([
      { id: "a", parentId: "c" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ]),
    true,
  );
});

test("usa uma variação padrão para controlar estoque de produto simples", () => {
  assert.equal(hasValidVariationInventory([defaultVariation]), true);
});

test("rejeita estoque negativo, SKU inválido e múltiplas variações padrão", () => {
  assert.equal(
    hasValidVariationInventory([
      { ...defaultVariation, availableQuantity: -1 },
    ]),
    false,
  );
  assert.equal(
    hasValidVariationInventory([{ ...defaultVariation, sku: "collab-001" }]),
    false,
  );
  assert.equal(
    hasValidVariationInventory([
      defaultVariation,
      { ...defaultVariation, sku: "COLLAB-002" },
    ]),
    false,
  );
  assert.equal(
    hasValidVariationInventory([
      defaultVariation,
      {
        ...defaultVariation,
        sku: "COLLAB-002",
        isActive: false,
      },
    ]),
    false,
  );
});

test("publica somente produto completo com categoria, imagem e estoque", () => {
  assert.equal(canPublishProduct(publishableProduct), true);
  assert.equal(
    canPublishProduct({ ...publishableProduct, categoryCount: 0 }),
    false,
  );
  assert.equal(
    canPublishProduct({ ...publishableProduct, primaryImageCount: 0 }),
    false,
  );
  assert.equal(
    canPublishProduct({ ...publishableProduct, variations: [] }),
    false,
  );
});

test("valida medidas e regras de empacotamento do cadastro logístico", () => {
  assert.equal(hasValidShippingProfile(shippingProfile), true);
  assert.equal(
    hasValidShippingProfile({ ...shippingProfile, variationId: "variation" }),
    false,
  );
  assert.equal(
    hasValidShippingProfile({
      ...shippingProfile,
      shipsSeparately: true,
      unitsPerPackage: 2,
    }),
    false,
  );
  assert.equal(
    hasValidShippingProfile({ ...shippingProfile, packageWeightGrams: 400 }),
    false,
  );
});

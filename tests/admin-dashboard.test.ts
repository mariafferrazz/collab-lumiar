import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { UnavailableCatalogImageStorage } from "@/lib/admin/image-storage";
import {
  formatPriceInput,
  normalizeSlug,
  parsePriceInCents,
  validateArtistAdminInput,
  validateCategoryAdminInput,
  validateProductAdminInput,
  validateProductImageAdminInput,
  validateShippingProfileAdminInput,
  validateStockAdminInput,
  validateVariationAdminInput,
} from "@/lib/admin/validation";

const productId = "11111111-1111-4111-8111-111111111111";
const variationId = "22222222-2222-4222-8222-222222222222";
const artistId = "33333333-3333-4333-8333-333333333333";
const categoryId = "44444444-4444-4444-8444-444444444444";

test("normaliza slug e converte dinheiro sem ponto flutuante", () => {
  assert.equal(normalizeSlug("  Cerâmica da Serra!  "), "ceramica-da-serra");
  assert.equal(parsePriceInCents("129,90"), 12_990);
  assert.equal(parsePriceInCents("0.05"), 5);
  assert.equal(parsePriceInCents("-1"), null);
  assert.equal(parsePriceInCents("1,999"), null);
  assert.equal(formatPriceInput(12_990), "129,90");
});

test("valida artista e bloqueia URL arbitrária de fotografia", () => {
  const valid = validateArtistAdminInput({
    artisticName: "Ateliê Lumiar",
    biography: "Cerâmica autoral produzida na serra.",
    instagramHandle: "@atelie.lumiar",
    isActive: "on",
  });
  const invalid = validateArtistAdminInput({
    artisticName: "Ateliê Lumiar",
    biography: "Cerâmica autoral produzida na serra.",
    photoPath: "https://example.com/foto.jpg",
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.ok(invalid.fieldErrors.photoPath);
});

test("valida hierarquia de categoria e referências de produto", () => {
  const category = validateCategoryAdminInput({
    name: "Cerâmica",
    parentId: categoryId,
    currentId: categoryId,
    displayOrder: "0",
  });
  const product = validateProductAdminInput({
    name: "Vaso da Serra",
    artistId,
    categoryIds: [categoryId, categoryId],
    price: "249,00",
  });

  assert.equal(category.success, false);
  assert.equal(product.success, true);
  if (product.success) {
    assert.equal(product.data.priceInCents, 24_900);
    assert.deepEqual(product.data.categoryIds, [categoryId]);
    assert.equal(product.data.publicationStatus, "draft");
  }
});

test("rejeita SKU, estoque e concorrência inválidos", () => {
  const variation = validateVariationAdminInput({
    productId,
    sku: "sku com espaço",
    availableQuantity: "-1",
  });
  const stock = validateStockAdminInput({
    variationId,
    availableQuantity: "3",
    expectedAvailableQuantity: "3",
    expectedUpdatedAt: "data-inválida",
  });

  assert.equal(variation.success, false);
  assert.equal(stock.success, false);
});

test("aceita apenas caminhos internos controlados para imagens", () => {
  const valid = validateProductImageAdminInput({
    productId,
    filePath: `catalog/${productId}/vaso.webp`,
    altText: "Vaso de cerâmica sobre mesa",
    displayOrder: "0",
    isPrimary: "on",
  });
  const traversal = validateProductImageAdminInput({
    productId,
    filePath: `catalog/${productId}/../segredo.png`,
    altText: "Arquivo inválido",
    displayOrder: "0",
  });

  assert.equal(valid.success, true);
  assert.equal(traversal.success, false);
});

test("valida peso, embalagem e envio separado", () => {
  const invalid = validateShippingProfileAdminInput({
    productId,
    variationId,
    itemWeightGrams: "500",
    itemHeightCm: "10",
    itemWidthCm: "10",
    itemLengthCm: "10",
    packageWeightGrams: "400",
    packageHeightCm: "12",
    packageWidthCm: "12",
    packageLengthCm: "12",
    shipsSeparately: "on",
    unitsPerPackage: "2",
  });

  assert.equal(invalid.success, false);
  if (!invalid.success) {
    assert.ok(invalid.fieldErrors.target);
    assert.ok(invalid.fieldErrors.packageWeightGrams);
    assert.ok(invalid.fieldErrors.unitsPerPackage);
  }
});

test("adaptador de imagem indisponível falha de forma explícita", async () => {
  const storage = new UnavailableCatalogImageStorage();
  assert.equal(storage.configured, false);
  await assert.rejects(storage.store(), /não está configurado/iu);
  await assert.rejects(storage.remove(), /não está configurado/iu);
});

test("toda Server Action administrativa revalida ADMIN no servidor", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "app", "admin", "actions.ts"),
    "utf8",
  );
  const actions = [
    ...source.matchAll(/export async function (\w+Action)\([\s\S]*?\n\}\n/gmu),
  ];

  assert.ok(
    actions.length >= 10,
    "A suíte deve auditar todas as mutações admin.",
  );
  for (const action of actions) {
    assert.match(
      action[0],
      /await requireAdminSession\(\);/u,
      `${action[1]} precisa revalidar a sessão ADMIN.`,
    );
  }
});

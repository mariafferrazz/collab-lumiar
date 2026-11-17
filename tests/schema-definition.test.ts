import assert from "node:assert/strict";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import { customerAddresses } from "@/db/schema/customers";
import { productPublicationStatus } from "@/db/schema/enums";
import { productVariations } from "@/db/schema/inventory";
import { shippingProfiles } from "@/db/schema/logistics";
import { productImages } from "@/db/schema/media";

test("mantém os estados de publicação previstos", () => {
  assert.deepEqual(productPublicationStatus.enumValues, [
    "draft",
    "published",
    "archived",
  ]);
});

test("modela IDs de usuário do Better Auth como UUID", () => {
  assert.equal(customerAddresses.userId.getSQLType(), "uuid");
});

test("protege estoque e variação padrão no schema", () => {
  const config = getTableConfig(productVariations);

  assert.equal(config.foreignKeys[0]?.onDelete, "restrict");
  assert.ok(
    config.checks.some(
      (constraint) =>
        constraint.name === "product_variations_quantity_nonnegative",
    ),
  );
  assert.ok(
    config.indexes.some(
      (index) =>
        index.config.name === "product_variations_default_product_unique" &&
        index.config.unique,
    ),
  );
});

test("protege imagem principal e histórico do produto", () => {
  const config = getTableConfig(productImages);

  assert.equal(config.foreignKeys[0]?.onDelete, "restrict");
  assert.ok(
    config.indexes.some(
      (index) =>
        index.config.name === "product_images_primary_product_unique" &&
        index.config.unique,
    ),
  );
});

test("exige alvo exclusivo e empacotamento válido na logística", () => {
  const config = getTableConfig(shippingProfiles);
  const checkNames = config.checks.map((constraint) => constraint.name);

  assert.ok(
    config.foreignKeys.every(
      (foreignKey) => foreignKey.onDelete === "restrict",
    ),
  );
  assert.ok(checkNames.includes("shipping_profiles_exactly_one_target"));
  assert.ok(
    checkNames.includes("shipping_profiles_units_per_package_positive"),
  );
  assert.ok(
    checkNames.includes("shipping_profiles_separate_package_single_unit"),
  );
});

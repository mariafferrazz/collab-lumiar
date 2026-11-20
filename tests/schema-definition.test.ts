import assert from "node:assert/strict";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import { account, session, user, verification } from "@/db/schema/auth";
import { customerAddresses } from "@/db/schema/customers";
import { productPublicationStatus } from "@/db/schema/enums";
import { productFinancialCosts } from "@/db/schema/financial";
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
  assert.equal(user.id.getSQLType(), "uuid");
  assert.equal(session.userId.getSQLType(), "uuid");
  assert.equal(account.userId.getSQLType(), "uuid");
  assert.equal(verification.id.getSQLType(), "uuid");
});

test("liga endereços ao usuário com exclusão segura", () => {
  const config = getTableConfig(customerAddresses);
  const userForeignKey = config.foreignKeys.find(
    (foreignKey) => foreignKey.reference().foreignTable === user,
  );

  assert.equal(userForeignKey?.onDelete, "cascade");
});

test("protege papel e índices essenciais da autenticação", () => {
  const userConfig = getTableConfig(user);
  const accountConfig = getTableConfig(account);
  const sessionConfig = getTableConfig(session);

  assert.ok(
    userConfig.checks.some(
      (constraint) => constraint.name === "user_role_allowed",
    ),
  );
  assert.ok(
    accountConfig.indexes.some(
      (index) =>
        index.config.name === "account_provider_account_unique" &&
        index.config.unique,
    ),
  );
  assert.ok(
    sessionConfig.indexes.some(
      (index) => index.config.name === "session_userId_idx",
    ),
  );
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

test("fixa no schema a decomposição financeira de 40% e 50/50", () => {
  const config = getTableConfig(productFinancialCosts);

  assert.ok(
    config.checks.some(
      (constraint) =>
        constraint.name === "product_financial_costs_fixed_agreement",
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

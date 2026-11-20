import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  getDemoProductBySlug,
  searchDemoProducts,
} from "@/lib/catalog/demo-catalog";
import { readPublicProductSearchInput } from "@/lib/catalog/public-query";
import {
  isSafePublicImageReference,
  PublicCatalogConfigurationError,
  resolvePublicCatalogSource,
} from "@/lib/catalog/source-config";

const localCatalogEnvironment = {
  CATALOG_DATA_SOURCE: "persisted-local",
  DATABASE_ENVIRONMENT: "local",
  MIGRATION_TARGET: "local-admin-postgres",
  DATABASE_URL:
    "postgresql://collab_local_admin:local-test-placeholder@127.0.0.1:55432/collab_local_admin",
};

test("seleciona demo por padrão e exige identidade local no catálogo persistido", () => {
  assert.equal(resolvePublicCatalogSource({}), "demo");
  assert.equal(
    resolvePublicCatalogSource(localCatalogEnvironment),
    "persisted-local",
  );
  assert.throws(
    () =>
      resolvePublicCatalogSource({
        ...localCatalogEnvironment,
        DATABASE_URL:
          "postgresql://collab:placeholder@postgres.railway.internal:5432/collab",
      }),
    PublicCatalogConfigurationError,
  );
  assert.throws(
    () => resolvePublicCatalogSource({ CATALOG_DATA_SOURCE: "automatic" }),
    PublicCatalogConfigurationError,
  );
});

test("valida parâmetros públicos e limita paginação no servidor", () => {
  const parsed = readPublicProductSearchInput({
    q: "  vaso   artesanal  ",
    categoria: "Cerâmica inválida",
    artista: "../../admin",
    disponibilidade: "in-stock",
    ordem: "price-desc",
    pagina: "2",
    limite: "999",
  });
  assert.deepEqual(parsed, {
    query: "vaso artesanal",
    category: null,
    artist: null,
    availability: "in-stock",
    sort: "price-desc",
    page: 2,
    pageSize: 24,
  });
});

test("modo demonstrativo permanece identificado e não contém campos financeiros", () => {
  const result = searchDemoProducts({
    query: "",
    category: null,
    artist: null,
    availability: "all",
    sort: "newest",
    page: 1,
    pageSize: 2,
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.total > result.rows.length, true);
  assert.ok(result.rows.every((product) => product.source === "demo"));

  const detail = getDemoProductBySlug(result.rows[0]?.slug ?? "");
  assert.ok(detail);
  const serialized = JSON.stringify(detail);
  for (const forbidden of [
    "artistCostInCents",
    "commercialAdditionInCents",
    "ownerShareInCents",
    "organizerShareInCents",
    "expectedPaymentFeeInCents",
    "expectedTaxInCents",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("aceita apenas referências públicas locais de imagem", () => {
  assert.equal(isSafePublicImageReference("/images/produto.webp"), true);
  assert.equal(isSafePublicImageReference("https://example.com/a.webp"), false);
  assert.equal(isSafePublicImageReference("/images/../private.webp"), false);
  assert.equal(isSafePublicImageReference("catalog/id/private.webp"), false);
});

test("prévia privada reafirma autorização, execução dinâmica e noindex", async () => {
  const preview = await readFile(
    path.join(
      process.cwd(),
      "src",
      "app",
      "admin",
      "produtos",
      "[id]",
      "preview",
      "page.tsx",
    ),
    "utf8",
  );
  assert.match(preview, /await requireAdminSession\(\)/u);
  assert.match(preview, /await connection\(\)/u);
  assert.match(preview, /index: false/u);
  assert.match(preview, /nocache: true/u);
  assert.doesNotMatch(preview, /[?&]admin=true|"use server"/u);
  assert.doesNotMatch(preview, /Action\b/u);
});

test("mutações administrativas invalidam todas as superfícies públicas", async () => {
  const actions = await readFile(
    path.join(process.cwd(), "src", "app", "admin", "actions.ts"),
    "utf8",
  );
  for (const route of [
    'revalidatePath("/")',
    'revalidatePath("/produtos")',
    'revalidatePath("/artistas")',
    'revalidatePath("/categorias")',
  ]) {
    assert.match(actions, new RegExp(route.replace(/[()/.]/gu, "\\$&"), "u"));
  }
});

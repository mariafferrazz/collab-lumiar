import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "@/db/schema";
import {
  addProductImageMetadata,
  createArtist,
  createCategory,
  createProduct,
  createVariation,
  deleteCategory,
  getProductDetail,
  setArtistActive,
  setProductPublicationStatus,
  updateCategory,
  updateVariation,
  updateVariationStock,
  upsertShippingProfile,
} from "@/lib/admin/catalog-repository";
import { AdminOperationError } from "@/lib/admin/types";
import { MemoryAuthEmailTransport } from "@/lib/auth/email";
import { createCollabAuth } from "@/lib/auth/server-factory";
import {
  getPersistedActiveArtistBySegment,
  getPersistedProductPreviewById,
  getPersistedPublishedProductBySlug,
  listPersistedPublishedProducts,
  listPersistedVisibleCategories,
  searchPersistedPublishedProducts,
} from "@/lib/catalog/public-catalog-repository";
import {
  createFinancialChargeRule,
  createFinancialPolicy,
  saveProductFinancialPricing,
  validateProductPricingScenario,
} from "@/lib/financial/repository";
import {
  MigrationRunnerError,
  runMigrations,
} from "../../scripts/lib/migration-runner";

const databaseUrl = process.env.COLLAB_TEST_DATABASE_URL;
const integrationEnabled =
  process.env.DATABASE_ENVIRONMENT === "test" &&
  process.env.MIGRATION_TARGET === "isolated-postgres" &&
  Boolean(databaseUrl);

function readErrorCode(error: unknown): string | undefined {
  let current = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
}

async function expectPostgresCode(
  operation: Promise<unknown>,
  expectedCode: string,
) {
  await assert.rejects(
    operation,
    (error) => readErrorCode(error) === expectedCode,
  );
}

async function expectRunnerCode(
  operation: Promise<unknown>,
  expectedCode: string,
) {
  await assert.rejects(
    operation,
    (error) =>
      error instanceof MigrationRunnerError && error.code === expectedCode,
  );
}

async function assertIsolationMarker(sql: Sql) {
  const rows = await sql<{ marker: string | null }[]>`
    SELECT shobj_description(oid, 'pg_database') AS marker
    FROM pg_database
    WHERE datname = current_database()
  `;

  assert.equal(rows[0]?.marker, "COLLAB_ISOLATED_TEST_DATABASE");
}

async function resetIsolatedDatabase(sql: Sql) {
  await assertIsolationMarker(sql);
  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
}

async function createMigrationFixture(id: string, migrationSql: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "collab-migrations-"));

  await writeMigrationFixture(directory, id, migrationSql);
  return directory;
}

async function writeMigrationFixture(
  directory: string,
  id: string,
  migrationSql: string,
) {
  const file = `${id}.sql`;
  const sha256 = createHash("sha256").update(migrationSql).digest("hex");

  await Promise.all([
    writeFile(path.join(directory, file), migrationSql, "utf8"),
    writeFile(
      path.join(directory, "manifest.json"),
      `${JSON.stringify(
        {
          formatVersion: 1,
          migrations: [{ id, file, sha256 }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  return sha256;
}

function runnerOptions(migrationsDirectory?: string) {
  return {
    databaseUrl,
    environment: process.env.DATABASE_ENVIRONMENT,
    target: process.env.MIGRATION_TARGET,
    migrationsDirectory,
  };
}

const authBaseURL = "http://127.0.0.1:3000";
const authTestHeaders = {
  origin: authBaseURL,
  "x-forwarded-for": "192.0.2.1",
} as const;

async function authRequest(
  auth: ReturnType<typeof createCollabAuth>,
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    cookie?: string;
    ipAddress?: string;
  } = {},
) {
  const headers = new Headers({
    origin: authBaseURL,
    "x-forwarded-for": options.ipAddress ?? "192.0.2.1",
  });

  if (options.body) {
    headers.set("content-type", "application/json");
  }
  if (options.cookie) {
    headers.set("cookie", options.cookie);
  }

  return auth.handler(
    new Request(`${authBaseURL}/api/auth${path}`, {
      method: options.method ?? "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
  );
}

function readSessionCookie(response: Response): string {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const values = getSetCookie
    ? getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  const match = values
    .join(";")
    .match(/(?:^|[;,]\s*)(collab\.session_token=[^;,\s]+)/u);

  assert.ok(match?.[1], "A sessão autenticada deve definir um cookie.");
  return match[1];
}

// biome-ignore format: Manter os cenários PostgreSQL agrupados facilita a auditoria da suíte destrutiva.
test(
  "migration e runner funcionam em PostgreSQL isolado",
  {
    skip: integrationEnabled
      ? false
      : "PostgreSQL descartável não foi provisionado.",
  },
  async (t) => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, {
      max: 6,
      prepare: false,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
    let artistId = "";
    let categoryId = "";
    let draftProductId = "";
    let publishedProductId = "";
    let defaultVariationId = "";

    try {
      await assertIsolationMarker(sql);

      await t.test("executa a migration uma vez e registra o ledger", async () => {
        await resetIsolatedDatabase(sql);

        const firstRun = await runMigrations(runnerOptions());
        const secondRun = await runMigrations(runnerOptions());

        assert.deepEqual(firstRun.applied, [
          "0000_collab_catalog",
          "0001_collab_auth",
          "0002_collab_financial_pricing",
        ]);
        assert.deepEqual(firstRun.skipped, []);
        assert.deepEqual(secondRun.applied, []);
        assert.deepEqual(secondRun.skipped, [
          "0000_collab_catalog",
          "0001_collab_auth",
          "0002_collab_financial_pricing",
        ]);
        assert.equal(firstRun.ledgerTable, "collab_schema_migrations");
        t.diagnostic(`PostgreSQL isolado: ${firstRun.serverVersion}`);

        const tables = await sql<{ tablename: string }[]>`
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY tablename
        `;
        assert.deepEqual(
          tables.map((row) => row.tablename),
          [
            "account",
            "artists",
            "categories",
            "collab_schema_migrations",
            "customer_addresses",
            "financial_audit_events",
            "financial_charge_rules",
            "financial_pricing_policies",
            "product_categories",
            "product_financial_costs",
            "product_images",
            "product_pricing_scenarios",
            "product_variations",
            "products",
            "session",
            "shipping_profiles",
            "user",
            "verification",
          ],
        );

        const functions = await sql<{ proname: string }[]>`
          SELECT proname
          FROM pg_proc
          INNER JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
          WHERE pg_namespace.nspname = 'public'
          ORDER BY proname
        `;
        assert.deepEqual(
          functions.map((row) => row.proname),
          [
            "collab_assert_product_financially_publishable",
            "collab_assert_product_publishable",
            "collab_prevent_category_cycle",
            "collab_protect_approved_financial_configuration",
            "collab_protect_financial_history",
            "collab_protect_validated_cost",
            "collab_set_updated_at",
            "collab_validate_pricing_scenario",
            "collab_validate_product_dependencies",
            "collab_validate_product_financial_dependencies",
          ],
        );

        const triggers = await sql<{ trigger_name: string }[]>`
          SELECT pg_trigger.tgname AS trigger_name
          FROM pg_trigger
          INNER JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
          INNER JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
          WHERE pg_namespace.nspname = 'public'
            AND NOT pg_trigger.tgisinternal
          ORDER BY pg_trigger.tgname
        `;
        assert.equal(triggers.length, 26);

        const indexes = await sql<{ indexname: string }[]>`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
        `;
        const indexNames = new Set(indexes.map((row) => row.indexname));
        assert.ok(indexNames.has("product_variations_default_product_unique"));
        assert.ok(indexNames.has("product_images_primary_product_unique"));
        assert.ok(indexNames.has("customer_addresses_default_user_unique"));

        const constraints = await sql<{ type: string; total: number }[]>`
          SELECT contype AS type, count(*)::integer AS total
          FROM pg_constraint
          INNER JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
          WHERE pg_namespace.nspname = 'public'
          GROUP BY contype
        `;
        const constraintTotals = new Map(
          constraints.map((row) => [row.type, row.total]),
        );
        assert.ok((constraintTotals.get("p") ?? 0) >= 18);
        assert.ok((constraintTotals.get("f") ?? 0) >= 21);
        assert.ok((constraintTotals.get("c") ?? 0) >= 39);

        const columnTypes = await sql<
          { table_name: string; column_name: string; data_type: string }[]
        >`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND (
              (table_name = 'customer_addresses' AND column_name = 'user_id')
              OR (table_name = 'shipping_profiles' AND column_name = 'item_height_cm')
              OR (table_name = 'products' AND column_name = 'price_in_cents')
            )
          ORDER BY table_name, column_name
        `;
        assert.deepEqual(Array.from(columnTypes), [
          {
            table_name: "customer_addresses",
            column_name: "user_id",
            data_type: "uuid",
          },
          {
            table_name: "products",
            column_name: "price_in_cents",
            data_type: "integer",
          },
          {
            table_name: "shipping_profiles",
            column_name: "item_height_cm",
            data_type: "numeric",
          },
        ]);
      });

      await t.test("protege hierarquias de categorias, inclusive concorrentes", async () => {
        const rootId = randomUUID();
        const childId = randomUUID();
        await sql`
          INSERT INTO categories (id, name, slug)
          VALUES
            (${rootId}, 'Raiz', ${`raiz-${rootId}`}),
            (${childId}, 'Filha', ${`filha-${childId}`})
        `;
        await sql`
          UPDATE categories
          SET parent_id = ${rootId}
          WHERE id = ${childId}
        `;

        const selfId = randomUUID();
        await expectPostgresCode(
          sql`
            INSERT INTO categories (id, name, slug, parent_id)
            VALUES (${selfId}, 'Inválida', ${`invalida-${selfId}`}, ${selfId})
          `,
          "23514",
        );
        await expectPostgresCode(
          sql`
            UPDATE categories
            SET parent_id = ${childId}
            WHERE id = ${rootId}
          `,
          "23514",
        );

        const categoryA = randomUUID();
        const categoryB = randomUUID();
        await sql`
          INSERT INTO categories (id, name, slug)
          VALUES
            (${categoryA}, 'Concorrente A', ${`concorrente-a-${categoryA}`}),
            (${categoryB}, 'Concorrente B', ${`concorrente-b-${categoryB}`})
        `;

        const firstClient = postgres(databaseUrl, { max: 1, prepare: false });
        const secondClient = postgres(databaseUrl, { max: 1, prepare: false });
        let releaseFirst: () => void = () => {};
        let markFirstReady: () => void = () => {};
        const firstGate = new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        const firstReady = new Promise<void>((resolve) => {
          markFirstReady = resolve;
        });

        try {
          const firstUpdate = firstClient.begin(async (transaction) => {
            await transaction`
              UPDATE categories SET parent_id = ${categoryB}
              WHERE id = ${categoryA}
            `;
            markFirstReady();
            await firstGate;
          });
          await firstReady;

          const secondUpdate = secondClient.begin(async (transaction) => {
            await transaction`
              UPDATE categories SET parent_id = ${categoryA}
              WHERE id = ${categoryB}
            `;
          });
          const secondAssertion = expectPostgresCode(secondUpdate, "23514");

          await new Promise((resolve) => setTimeout(resolve, 100));
          releaseFirst();
          await firstUpdate;
          await secondAssertion;
        } finally {
          releaseFirst();
          await Promise.all([
            firstClient.end({ timeout: 5 }),
            secondClient.end({ timeout: 5 }),
          ]);
        }
      });

      await t.test("valida estados e dependências de publicação", async () => {
        artistId = randomUUID();
        categoryId = randomUUID();
        draftProductId = randomUUID();
        publishedProductId = randomUUID();
        defaultVariationId = randomUUID();

        await sql`
          INSERT INTO artists (id, artistic_name, biography)
          VALUES (${artistId}, 'Artista Integração', 'Biografia de integração')
        `;
        await sql`
          INSERT INTO categories (id, name, slug)
          VALUES (${categoryId}, 'Integração', ${`integracao-${categoryId}`})
        `;
        await sql`
          INSERT INTO products (
            id, name, slug, artist_id, price_in_cents, publication_status
          )
          VALUES (
            ${draftProductId},
            'Rascunho',
            ${`rascunho-${draftProductId}`},
            ${artistId},
            1000,
            'draft'
          )
        `;
        await sql`
          INSERT INTO products (
            name, slug, artist_id, price_in_cents, publication_status
          )
          VALUES (
            'Arquivado',
            ${`arquivado-${randomUUID()}`},
            ${artistId},
            1000,
            'archived'
          )
        `;

        await expectPostgresCode(
          sql`
            INSERT INTO products (
              name, slug, artist_id, price_in_cents,
              publication_status, published_at
            )
            VALUES (
              'Incompleto',
              ${`incompleto-${randomUUID()}`},
              ${artistId},
              1000,
              'published',
              now()
            )
          `,
          "23514",
        );

        await expectPostgresCode(
          sql.begin(async (transaction) => {
            await transaction`
              INSERT INTO products (
                name, slug, description, artist_id, material,
                production_technique, price_in_cents,
                publication_status, published_at
              )
              VALUES (
                'Sem dependências',
                ${`sem-dependencias-${randomUUID()}`},
                'Descrição',
                ${artistId},
                'Material',
                'Técnica',
                1000,
                'published',
                now()
              )
            `;
          }),
          "23514",
        );

        await sql.begin(async (transaction) => {
          const financialActorId = randomUUID();
          const policyId = randomUUID();
          const paymentRuleId = randomUUID();
          const taxRuleId = randomUUID();
          const costId = randomUUID();
          await transaction`
            INSERT INTO products (
              id, name, slug, description, artist_id, material,
              production_technique, price_in_cents,
              publication_status, published_at
            )
            VALUES (
              ${publishedProductId},
              'Publicado',
              ${`publicado-${publishedProductId}`},
              'Descrição completa',
              ${artistId},
              'Cerâmica',
              'Modelagem manual',
              14001,
              'draft',
              NULL
            )
          `;
          await transaction`
            INSERT INTO product_categories (product_id, category_id)
            VALUES (${publishedProductId}, ${categoryId})
          `;
          await transaction`
            INSERT INTO product_variations (
              id, product_id, sku, available_quantity, is_default
            )
            VALUES (
              ${defaultVariationId},
              ${publishedProductId},
              'COLLAB-INTEGRATION-001',
              5,
              true
            )
          `;
          await transaction`
            INSERT INTO product_images (
              product_id, file_path, alt_text, display_order, is_primary
            )
            VALUES (
              ${publishedProductId},
              '/integration/primary.webp',
              'Imagem principal de integração',
              0,
              true
            )
          `;
          await transaction`
            INSERT INTO "user" (id, name, email, email_verified, role)
            VALUES (${financialActorId}, 'Admin Financeiro Isolado', ${`finance-${financialActorId}@example.com`}, true, 'ADMIN')
          `;
          await transaction`
            INSERT INTO financial_pricing_policies (
              id, code, version, status, effective_from, source,
              approved_by_user_id, approved_at
            ) VALUES (
              ${policyId}, ${`POLICY_${financialActorId.replaceAll("-", "")}`}, 1,
              'approved', now() - interval '1 day', 'Teste isolado',
              ${financialActorId}, now()
            )
          `;
          await transaction`
            INSERT INTO financial_charge_rules (
              id, kind, name, payment_method, percentage_basis_points,
              fixed_amount_in_cents, incidence_base, application_scope,
              status, effective_from, source, approved_by_user_id, approved_at
            ) VALUES
              (${paymentRuleId}, 'payment_fee', 'Taxa isolada', 'pix', 0, 1,
               'final_merchandise', 'per_item', 'approved', now() - interval '1 day',
               'Teste isolado', ${financialActorId}, now()),
              (${taxRuleId}, 'tax', 'Tributo zero validado', NULL, 0, 0,
               'commercial_base', 'per_item', 'approved', now() - interval '1 day',
               'Teste isolado', ${financialActorId}, now())
          `;
          await transaction`
            INSERT INTO product_financial_costs (
              id, product_id, policy_id, artist_cost_in_cents,
              commercial_addition_in_cents, owner_share_in_cents,
              organizer_share_in_cents, rounding_residual_in_cents,
              commercial_base_in_cents, calculation_version
            ) VALUES (
              ${costId}, ${publishedProductId}, ${policyId}, 10000,
              4000, 2000, 2000, 0, 14000, 'collab-pricing-v1'
            )
          `;
          await transaction`
            INSERT INTO product_pricing_scenarios (
              cost_id, payment_method, payment_fee_rule_id, tax_rule_id,
              expected_payment_fee_in_cents, expected_tax_in_cents,
              calculation_residual_in_cents, final_merchandise_price_in_cents,
              status, is_default, calculation_version,
              validated_by_user_id, validated_at
            ) VALUES (
              ${costId}, 'pix', ${paymentRuleId}, ${taxRuleId}, 1, 0, 0, 14001,
              'validated', true, 'collab-pricing-v1', ${financialActorId}, now()
            )
          `;
          await transaction`
            UPDATE products
            SET publication_status = 'published', published_at = now()
            WHERE id = ${publishedProductId}
          `;
        });

        const simpleVariation = await sql<
          { color: string | null; size: string | null }[]
        >`
          SELECT color, size
          FROM product_variations
          WHERE id = ${defaultVariationId}
        `;
        assert.deepEqual(simpleVariation[0], { color: null, size: null });

        await expectPostgresCode(
          sql`DELETE FROM products WHERE id = ${publishedProductId}`,
          "23001",
        );
        await expectPostgresCode(
          sql.begin(async (transaction) => {
            await transaction`
              DELETE FROM product_categories
              WHERE product_id = ${publishedProductId}
                AND category_id = ${categoryId}
            `;
          }),
          "23514",
        );
      });

      await t.test("protege estoque e imagens em alterações concorrentes", async () => {
        await expectPostgresCode(
          sql`
            INSERT INTO product_variations (
              product_id, sku, available_quantity
            )
            VALUES (${draftProductId}, 'COLLAB-INTEGRATION-001', 1)
          `,
          "23505",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO product_variations (
              product_id, sku, available_quantity
            )
            VALUES (${draftProductId}, 'COLLAB-INTEGRATION-NEGATIVE', -1)
          `,
          "23514",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO product_variations (
              product_id, sku, available_quantity, is_default
            )
            VALUES (${publishedProductId}, 'COLLAB-INTEGRATION-002', 1, true)
          `,
          "23505",
        );

        await expectPostgresCode(
          sql`
            INSERT INTO product_images (
              product_id, file_path, alt_text, display_order, is_primary
            )
            VALUES (
              ${publishedProductId},
              '/integration/second-primary.webp',
              'Segunda principal',
              1,
              true
            )
          `,
          "23505",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO product_images (
              product_id, file_path, alt_text, display_order
            )
            VALUES (
              ${publishedProductId},
              '/integration/repeated-order.webp',
              'Ordem repetida',
              0
            )
          `,
          "23505",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO product_images (
              product_id, file_path, alt_text, display_order
            )
            VALUES (
              ${randomUUID()},
              '/integration/orphan.webp',
              'Imagem órfã',
              0
            )
          `,
          "23503",
        );

        const concurrentProductId = randomUUID();
        const variationA = randomUUID();
        const variationB = randomUUID();
        await sql`
          INSERT INTO products (
            id, name, slug, artist_id, price_in_cents
          )
          VALUES (
            ${concurrentProductId},
            'Estoque concorrente',
            ${`estoque-concorrente-${concurrentProductId}`},
            ${artistId},
            1000
          )
        `;
        await sql`
          INSERT INTO product_variations (
            id, product_id, sku, available_quantity
          )
          VALUES
            (${variationA}, ${concurrentProductId}, ${`CONCURRENT-${variationA.toUpperCase()}`}, 1),
            (${variationB}, ${concurrentProductId}, ${`CONCURRENT-${variationB.toUpperCase()}`}, 1)
        `;

        const firstClient = postgres(databaseUrl, { max: 1, prepare: false });
        const secondClient = postgres(databaseUrl, { max: 1, prepare: false });
        let releaseFirst: () => void = () => {};
        let markFirstReady: () => void = () => {};
        const firstGate = new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        const firstReady = new Promise<void>((resolve) => {
          markFirstReady = resolve;
        });

        try {
          const firstUpdate = firstClient.begin(async (transaction) => {
            await transaction`
              UPDATE product_variations SET is_default = true
              WHERE id = ${variationA}
            `;
            markFirstReady();
            await firstGate;
          });
          await firstReady;

          const secondUpdate = secondClient.begin(async (transaction) => {
            await transaction`
              UPDATE product_variations SET is_default = true
              WHERE id = ${variationB}
            `;
          });
          const secondAssertion = expectPostgresCode(secondUpdate, "23505");

          await new Promise((resolve) => setTimeout(resolve, 100));
          releaseFirst();
          await firstUpdate;
          await secondAssertion;
        } finally {
          releaseFirst();
          await Promise.all([
            firstClient.end({ timeout: 5 }),
            secondClient.end({ timeout: 5 }),
          ]);
        }
      });

      await t.test("valida logística, herança e timestamps", async () => {
        const productProfile = await sql<{ id: string }[]>`
          INSERT INTO shipping_profiles (
            product_id,
            item_weight_grams,
            item_height_cm,
            item_width_cm,
            item_length_cm,
            package_weight_grams,
            package_height_cm,
            package_width_cm,
            package_length_cm,
            is_fragile,
            ships_separately,
            units_per_package
          )
          VALUES (
            ${publishedProductId}, 500, 10, 12, 14, 650, 13, 15, 17,
            true, true, 1
          )
          RETURNING id
        `;
        const inheritedProfile = await sql<{ effective_id: string }[]>`
          SELECT COALESCE(variation_profile.id, product_profile.id) AS effective_id
          FROM product_variations
          LEFT JOIN shipping_profiles AS variation_profile
            ON variation_profile.variation_id = product_variations.id
          LEFT JOIN shipping_profiles AS product_profile
            ON product_profile.product_id = product_variations.product_id
          WHERE product_variations.id = ${defaultVariationId}
        `;
        assert.equal(inheritedProfile[0]?.effective_id, productProfile[0]?.id);

        const variationProfile = await sql<{ id: string }[]>`
          INSERT INTO shipping_profiles (
            variation_id,
            item_weight_grams,
            item_height_cm,
            item_width_cm,
            item_length_cm,
            package_weight_grams,
            package_height_cm,
            package_width_cm,
            package_length_cm,
            is_fragile
          )
          VALUES (
            ${defaultVariationId}, 520, 11, 13, 15, 680, 14, 16, 18, true
          )
          RETURNING id
        `;
        const overriddenProfile = await sql<{ effective_id: string }[]>`
          SELECT COALESCE(variation_profile.id, product_profile.id) AS effective_id
          FROM product_variations
          LEFT JOIN shipping_profiles AS variation_profile
            ON variation_profile.variation_id = product_variations.id
          LEFT JOIN shipping_profiles AS product_profile
            ON product_profile.product_id = product_variations.product_id
          WHERE product_variations.id = ${defaultVariationId}
        `;
        assert.equal(overriddenProfile[0]?.effective_id, variationProfile[0]?.id);

        const logisticsProductId = randomUUID();
        const logisticsVariationId = randomUUID();
        await sql`
          INSERT INTO products (id, name, slug, artist_id, price_in_cents)
          VALUES (
            ${logisticsProductId},
            'Logística inválida',
            ${`logistica-${logisticsProductId}`},
            ${artistId},
            1000
          )
        `;
        await sql`
          INSERT INTO product_variations (
            id, product_id, sku, available_quantity
          )
          VALUES (
            ${logisticsVariationId},
            ${logisticsProductId},
            ${`LOGISTICS-${logisticsVariationId.toUpperCase()}`},
            1
          )
        `;

        const baseInvalidShipping = {
          productId: logisticsProductId,
          variationId: logisticsVariationId,
        };
        await expectPostgresCode(
          sql`
            INSERT INTO shipping_profiles (
              product_id, variation_id,
              item_weight_grams, item_height_cm, item_width_cm, item_length_cm,
              package_weight_grams, package_height_cm, package_width_cm,
              package_length_cm
            )
            VALUES (
              ${baseInvalidShipping.productId},
              ${baseInvalidShipping.variationId},
              100, 1, 1, 1, 100, 1, 1, 1
            )
          `,
          "23514",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO shipping_profiles (
              product_id,
              item_weight_grams, item_height_cm, item_width_cm, item_length_cm,
              package_weight_grams, package_height_cm, package_width_cm,
              package_length_cm
            )
            VALUES (${logisticsProductId}, 100, 0, 1, 1, 100, 1, 1, 1)
          `,
          "23514",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO shipping_profiles (
              product_id,
              item_weight_grams, item_height_cm, item_width_cm, item_length_cm,
              package_weight_grams, package_height_cm, package_width_cm,
              package_length_cm
            )
            VALUES (${logisticsProductId}, -1, 1, 1, 1, 100, 1, 1, 1)
          `,
          "23514",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO shipping_profiles (
              product_id,
              item_weight_grams, item_height_cm, item_width_cm, item_length_cm,
              package_weight_grams, package_height_cm, package_width_cm,
              package_length_cm
            )
            VALUES (${logisticsProductId}, 200, 1, 1, 1, 100, 1, 1, 1)
          `,
          "23514",
        );
        await expectPostgresCode(
          sql`
            INSERT INTO shipping_profiles (
              product_id,
              item_weight_grams, item_height_cm, item_width_cm, item_length_cm,
              package_weight_grams, package_height_cm, package_width_cm,
              package_length_cm, ships_separately, units_per_package
            )
            VALUES (${logisticsProductId}, 100, 1, 1, 1, 100, 1, 1, 1, true, 2)
          `,
          "23514",
        );

        const beforeUpdate = await sql<
          { created_at: Date; updated_at: Date }[]
        >`
          SELECT created_at, updated_at FROM artists WHERE id = ${artistId}
        `;
        assert.equal(
          beforeUpdate[0]?.created_at.getTime(),
          beforeUpdate[0]?.updated_at.getTime(),
        );
        await new Promise((resolve) => setTimeout(resolve, 20));
        const afterUpdate = await sql<{ updated_at: Date }[]>`
          UPDATE artists
          SET biography = 'Biografia atualizada'
          WHERE id = ${artistId}
          RETURNING updated_at
        `;
        assert.ok(
          (afterUpdate[0]?.updated_at.getTime() ?? 0) >
            (beforeUpdate[0]?.updated_at.getTime() ?? 0),
        );
      });

      await t.test(
        "executa cadastro, verificação, sessão e recuperação no Better Auth",
        async () => {
          await resetIsolatedDatabase(sql);
          await runMigrations(runnerOptions());

          const database = drizzle({ client: sql, schema });
          const emailTransport = new MemoryAuthEmailTransport();
          const disabledAuth = createCollabAuth({
            database,
            baseURL: authBaseURL,
            secret: "collab-isolated-disabled-test-secret-32-chars",
            emailTransport,
          });
          const disabledEmail = `bloqueado-${randomUUID()}@example.com`;
          const disabledRegistration = await authRequest(
            disabledAuth,
            "/sign-up/email",
            {
              body: {
                name: "Cadastro Bloqueado",
                email: disabledEmail,
                password: "cadastro-publico-desabilitado-2026",
              },
            },
          );
          assert.notEqual(disabledRegistration.status, 200);
          const disabledUsers = await sql<{ total: number }[]>`
            SELECT count(*)::integer AS total FROM "user" WHERE email = ${disabledEmail}
          `;
          assert.equal(disabledUsers[0]?.total, 0);

          const auth = createCollabAuth({
            database,
            baseURL: authBaseURL,
            secret: "collab-isolated-test-secret-with-32-characters",
            emailTransport,
            publicSignupEnabled: true,
          });
          const email = `cliente-${randomUUID()}@example.com`;
          const password = "senha-segura-inicial-2026"; // gitleaks:allow -- fixture local, sem valor real.
          const newPassword = "senha-segura-atualizada-2026"; // gitleaks:allow -- fixture local, sem valor real.
          const incorrectPassword = "senha-incorreta-2026"; // gitleaks:allow -- fixture local, sem valor real.

          const invalidRegistration = await authRequest(
            auth,
            "/sign-up/email",
            {
              body: {
                name: "C",
                email: "invalido",
                password: "curta",
              },
            },
          );
          assert.notEqual(invalidRegistration.status, 200);

          const attemptedRoleEscalation = await authRequest(
            auth,
            "/sign-up/email",
            {
              body: {
                name: "Cliente Isolado",
                email,
                password,
                role: "ADMIN",
              },
            },
          );
          assert.equal(attemptedRoleEscalation.status, 400);

          const registration = await authRequest(auth, "/sign-up/email", {
            body: {
              name: "Cliente Isolado",
              email,
              password,
            },
          });
          assert.equal(registration.status, 200);
          assert.equal(emailTransport.messages.length, 1);
          assert.equal(
            emailTransport.messages[0]?.purpose,
            "email-verification",
          );

          const users = await sql<
            { id: string; email_verified: boolean; role: string }[]
          >`
            SELECT id, email_verified, role
            FROM "user"
            WHERE email = ${email}
          `;
          const createdUser = users[0];
          assert.ok(createdUser);
          assert.match(
            createdUser.id,
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
          );
          assert.equal(createdUser.email_verified, false);
          assert.equal(createdUser.role, "CUSTOMER");

          const credentials = await sql<
            { password: string | null; provider_id: string }[]
          >`
            SELECT password, provider_id
            FROM account
            WHERE user_id = ${createdUser.id}
          `;
          assert.equal(credentials[0]?.provider_id, "credential");
          assert.ok(credentials[0]?.password);
          assert.notEqual(credentials[0]?.password, password);

          const unverifiedLogin = await authRequest(auth, "/sign-in/email", {
            body: { email, password },
          });
          assert.notEqual(unverifiedLogin.status, 200);

          const verificationURL = emailTransport.messages[0]?.actionUrl;
          assert.ok(verificationURL);
          const verification = await auth.handler(
            new Request(verificationURL, {
              method: "GET",
              headers: authTestHeaders,
            }),
          );
          assert.ok(verification.status < 400);
          const verifiedUsers = await sql<{ email_verified: boolean }[]>`
            SELECT email_verified FROM "user" WHERE id = ${createdUser.id}
          `;
          assert.equal(verifiedUsers[0]?.email_verified, true);

          const invalidLogin = await authRequest(auth, "/sign-in/email", {
            body: { email, password: incorrectPassword },
          });
          assert.notEqual(invalidLogin.status, 200);
          assert.doesNotMatch(await invalidLogin.text(), new RegExp(email, "u"));

          const login = await authRequest(auth, "/sign-in/email", {
            body: { email, password, rememberMe: true },
          });
          assert.equal(login.status, 200);
          const firstCookie = readSessionCookie(login);
          const activeSession = await authRequest(auth, "/get-session", {
            method: "GET",
            cookie: firstCookie,
          });
          const activeSessionData = (await activeSession.json()) as {
            user?: { id?: string; role?: string };
          } | null;
          assert.equal(activeSessionData?.user?.id, createdUser.id);
          assert.equal(activeSessionData?.user?.role, "CUSTOMER");

          const forbiddenAdmin = await authRequest(
            auth,
            "/admin/list-users",
            {
              method: "GET",
              cookie: firstCookie,
            },
          );
          assert.equal(forbiddenAdmin.status, 403);

          emailTransport.clear();
          const unknownRecovery = await authRequest(
            auth,
            "/request-password-reset",
            {
              body: {
                email: `inexistente-${randomUUID()}@example.com`,
                redirectTo: "/redefinir-senha",
              },
            },
          );
          assert.equal(unknownRecovery.status, 200);
          const unknownRecoveryBody = await unknownRecovery.text();
          assert.equal(emailTransport.messages.length, 0);

          const recovery = await authRequest(
            auth,
            "/request-password-reset",
            {
              body: { email, redirectTo: "/redefinir-senha" },
            },
          );
          assert.equal(recovery.status, 200);
          assert.equal(await recovery.text(), unknownRecoveryBody);
          const resetActionURL = emailTransport.messages.find(
            (message) => message.purpose === "password-reset",
          )?.actionUrl;
          assert.ok(resetActionURL);
          const resetRedirect = await auth.handler(
            new Request(resetActionURL, {
              method: "GET",
              headers: authTestHeaders,
            }),
          );
          assert.ok(resetRedirect.status >= 300 && resetRedirect.status < 400);
          const resetLocation = resetRedirect.headers.get("location");
          assert.ok(resetLocation);
          const resetToken = new URL(resetLocation, authBaseURL).searchParams.get(
            "token",
          );
          assert.ok(resetToken);
          await sql`
            UPDATE verification
            SET expires_at = now() - interval '1 minute'
            WHERE identifier = ${`reset-password:${resetToken}`}
          `;
          const expiredReset = await authRequest(auth, "/reset-password", {
            body: { newPassword, token: resetToken },
          });
          assert.notEqual(expiredReset.status, 200);

          emailTransport.clear();
          const renewedRecovery = await authRequest(
            auth,
            "/request-password-reset",
            {
              body: { email, redirectTo: "/redefinir-senha" },
            },
          );
          assert.equal(renewedRecovery.status, 200);
          const renewedActionURL = emailTransport.messages.find(
            (message) => message.purpose === "password-reset",
          )?.actionUrl;
          assert.ok(renewedActionURL);
          const renewedRedirect = await auth.handler(
            new Request(renewedActionURL, {
              method: "GET",
              headers: authTestHeaders,
            }),
          );
          const renewedLocation = renewedRedirect.headers.get("location");
          assert.ok(renewedLocation);
          const renewedResetToken = new URL(
            renewedLocation,
            authBaseURL,
          ).searchParams.get("token");
          assert.ok(renewedResetToken);
          const reset = await authRequest(auth, "/reset-password", {
            body: { newPassword, token: renewedResetToken },
          });
          assert.equal(reset.status, 200);
          const reusedReset = await authRequest(auth, "/reset-password", {
            body: { newPassword, token: renewedResetToken },
          });
          assert.notEqual(reusedReset.status, 200);

          const revokedSession = await authRequest(auth, "/get-session", {
            method: "GET",
            cookie: firstCookie,
          });
          assert.equal(await revokedSession.json(), null);

          const loginAfterReset = await authRequest(auth, "/sign-in/email", {
            body: { email, password: newPassword },
          });
          assert.equal(loginAfterReset.status, 200);
          const expiringCookie = readSessionCookie(loginAfterReset);
          await sql`
            UPDATE session
            SET expires_at = now() - interval '1 minute'
            WHERE user_id = ${createdUser.id}
          `;
          const expiredSession = await authRequest(auth, "/get-session", {
            method: "GET",
            cookie: expiringCookie,
          });
          assert.equal(await expiredSession.json(), null);

          const finalLogin = await authRequest(auth, "/sign-in/email", {
            body: { email, password: newPassword },
          });
          const logoutCookie = readSessionCookie(finalLogin);
          const logout = await authRequest(auth, "/sign-out", {
            cookie: logoutCookie,
          });
          assert.equal(logout.status, 200);
          const loggedOutSession = await authRequest(auth, "/get-session", {
            method: "GET",
            cookie: logoutCookie,
          });
          assert.equal(await loggedOutSession.json(), null);

          const addressId = randomUUID();
          await sql`
            INSERT INTO customer_addresses (
              id, user_id, label, recipient_name, postal_code, street,
              number, neighborhood, city, state_code
            ) VALUES (
              ${addressId}, ${createdUser.id}, 'Casa', 'Cliente Isolado',
              '28616000', 'Rua de Teste', '10', 'Centro', 'Lumiar', 'RJ'
            )
          `;
          await sql`DELETE FROM "user" WHERE id = ${createdUser.id}`;
          const orphanAddresses = await sql<{ total: number }[]>`
            SELECT count(*)::integer AS total
            FROM customer_addresses
            WHERE id = ${addressId}
          `;
          assert.equal(orphanAddresses[0]?.total, 0);
        },
      );

      await t.test(
        "trata verificação expirada, reenvio e reutilização sem privilégio",
        async () => {
          await resetIsolatedDatabase(sql);
          await runMigrations(runnerOptions());

          const database = drizzle({ client: sql, schema });
          const emailTransport = new MemoryAuthEmailTransport();
          const auth = createCollabAuth({
            database,
            baseURL: authBaseURL,
            secret: "collab-short-lived-token-test-secret-32-chars",
            emailTransport,
            publicSignupEnabled: true,
            tokenExpiresInSeconds: 3,
          });
          const email = `token-${randomUUID()}@example.com`;
          const registration = await authRequest(auth, "/sign-up/email", {
            body: {
              name: "Cliente Token",
              email,
              password: "token-temporario-teste-2026",
            },
          });
          assert.equal(registration.status, 200);
          const expiredVerificationURL = emailTransport.messages[0]?.actionUrl;
          assert.ok(expiredVerificationURL);

          await new Promise((resolve) => setTimeout(resolve, 3_100));
          const expiredVerification = await auth.handler(
            new Request(expiredVerificationURL, {
              method: "GET",
              headers: authTestHeaders,
            }),
          );
          assert.ok(
            expiredVerification.status >= 300 &&
              expiredVerification.status < 400,
          );
          assert.match(
            expiredVerification.headers.get("location") ?? "",
            /error=TOKEN_EXPIRED/u,
          );
          const unverified = await sql<{ email_verified: boolean }[]>`
            SELECT email_verified FROM "user" WHERE email = ${email}
          `;
          assert.equal(unverified[0]?.email_verified, false);

          emailTransport.clear();
          const resend = await authRequest(
            auth,
            "/send-verification-email",
            {
              body: { email, callbackURL: "/verificar-email" },
            },
          );
          assert.equal(resend.status, 200);
          assert.equal(emailTransport.messages.length, 1);
          const freshVerificationURL = emailTransport.messages[0]?.actionUrl;
          assert.ok(freshVerificationURL);
          const freshVerification = await auth.handler(
            new Request(freshVerificationURL, {
              method: "GET",
              headers: authTestHeaders,
            }),
          );
          assert.ok(
            freshVerification.status >= 300 && freshVerification.status < 400,
          );

          const reuse = await auth.handler(
            new Request(freshVerificationURL, {
              method: "GET",
              headers: authTestHeaders,
            }),
          );
          assert.ok(reuse.status >= 300 && reuse.status < 400);
          const protectedUser = await sql<
            { email_verified: boolean; role: string }[]
          >`
            SELECT email_verified, role FROM "user" WHERE email = ${email}
          `;
          assert.deepEqual(protectedUser[0], {
            email_verified: true,
            role: "CUSTOMER",
          });
          const sessions = await sql<{ total: number }[]>`
            SELECT count(*)::integer AS total FROM session
          `;
          assert.equal(sessions[0]?.total, 0);
        },
      );

      await t.test(
        "executa CRUD administrativo com integridade e autorização em banco isolado",
        async () => {
          await resetIsolatedDatabase(sql);
          await runMigrations(runnerOptions());

          const database = drizzle({ client: sql, schema });
          const artist = await createArtist(database, {
            artisticName: "Ateliê de Integração",
            biography: "Artista criada exclusivamente no banco descartável.",
            photoPath: null,
            instagramHandle: "atelie.integracao",
            isActive: true,
          });
          assert.ok(artist);
          const parent = await createCategory(database, {
            name: "Casa",
            slug: "casa-integracao",
            description: null,
            parentId: null,
            displayOrder: 0,
          });
          const child = await createCategory(database, {
            name: "Cerâmica",
            slug: "ceramica-integracao",
            description: null,
            parentId: parent?.id ?? null,
            displayOrder: 1,
          });
          assert.ok(parent && child);

          const product = await createProduct(database, {
            name: "Vaso de Integração",
            slug: "vaso-integracao",
            description: "Vaso autoral usado somente no teste descartável.",
            artistId: artist.id,
            categoryIds: [child.id],
            material: "Cerâmica",
            productionTechnique: "Modelagem manual",
            priceInCents: 24_900,
            publicationStatus: "draft",
          });
          assert.ok(product);
          const draftProduct = await createProduct(database, {
            name: "Rascunho de Integração",
            slug: "rascunho-integracao",
            description: null,
            artistId: artist.id,
            categoryIds: [child.id],
            material: null,
            productionTechnique: null,
            priceInCents: 0,
            publicationStatus: "draft",
          });
          assert.ok(draftProduct);
          const draftPreview = await getPersistedProductPreviewById(
            database,
            draftProduct.id,
          );
          assert.equal(draftPreview?.publicationStatus, "draft");
          assert.equal(draftPreview?.priceInCents, null);
          assert.ok(draftPreview?.publicationBlockers.length);
          assert.equal(
            (
              await listPersistedPublishedProducts(database)
            ).some((item) => item.id === draftProduct.id),
            false,
          );
          await assert.rejects(
            createProduct(database, {
              name: "Slug duplicado",
              slug: "vaso-integracao",
              description: null,
              artistId: artist.id,
              categoryIds: [child.id],
              material: null,
              productionTechnique: null,
              priceInCents: 1_000,
              publicationStatus: "draft",
            }),
            (error) =>
              error instanceof AdminOperationError && error.code === "CONFLICT",
          );

          const variation = await createVariation(database, {
            productId: product.id,
            sku: "VASO-INTEGRACAO-01",
            color: "Barro",
            size: "Único",
            availableQuantity: 3,
            specificPriceInCents: null,
            isActive: true,
            isDefault: true,
          });
          assert.ok(variation);
          await addProductImageMetadata(database, {
            productId: product.id,
            filePath: `catalog/${product.id}/vaso.webp`,
            altText: "Vaso de integração sobre fundo neutro",
            displayOrder: 0,
            isPrimary: true,
          });
          await upsertShippingProfile(database, {
            productId: product.id,
            variationId: null,
            itemWeightGrams: 500,
            itemHeightCm: 20,
            itemWidthCm: 12,
            itemLengthCm: 12,
            packageWeightGrams: 650,
            packageHeightCm: 24,
            packageWidthCm: 16,
            packageLengthCm: 16,
            isFragile: true,
            shipsSeparately: true,
            unitsPerPackage: 1,
          });
          await assert.rejects(
            setProductPublicationStatus(database, product.id, "published"),
            (error) =>
              error instanceof AdminOperationError &&
              error.code === "INVALID_INPUT",
          );
          const financialActorId = randomUUID();
          await sql`
            INSERT INTO "user" (id, name, email, email_verified, role)
            VALUES (${financialActorId}, 'Admin Financeiro Teste', ${`finance-admin-${financialActorId}@example.com`}, true, 'ADMIN')
          `;
          const policy = await createFinancialPolicy(
            database,
            {
              code: "COLLAB_TEST_POLICY",
              version: 1,
              effectiveFrom: new Date(Date.now() - 86_400_000),
              effectiveUntil: null,
              source: "Política exclusiva do PostgreSQL descartável",
              approve: true,
            },
            financialActorId,
          );
          const paymentRule = await createFinancialChargeRule(
            database,
            {
              kind: "payment_fee",
              name: "Taxa descartável",
              paymentMethod: "pix",
              percentageBasisPoints: 500,
              fixedAmountInCents: 0,
              incidenceBase: "final_merchandise",
              applicationScope: "per_item",
              effectiveFrom: new Date(Date.now() - 86_400_000),
              effectiveUntil: null,
              source: "Condição exclusiva do teste isolado",
              approve: true,
            },
            financialActorId,
          );
          const taxRule = await createFinancialChargeRule(
            database,
            {
              kind: "tax",
              name: "Tributo zero descartável",
              paymentMethod: null,
              percentageBasisPoints: 0,
              fixedAmountInCents: 0,
              incidenceBase: "commercial_base",
              applicationScope: "per_item",
              effectiveFrom: new Date(Date.now() - 86_400_000),
              effectiveUntil: null,
              source: "Hipótese zero exclusiva do teste isolado",
              approve: true,
            },
            financialActorId,
          );
          const expiredPaymentRule = await createFinancialChargeRule(
            database,
            {
              kind: "payment_fee",
              name: "Taxa descartável vencida",
              paymentMethod: "pix",
              percentageBasisPoints: 400,
              fixedAmountInCents: 0,
              incidenceBase: "final_merchandise",
              applicationScope: "per_item",
              effectiveFrom: new Date(Date.now() - 172_800_000),
              effectiveUntil: new Date(Date.now() - 86_400_000),
              source: "Regra vencida exclusiva do teste isolado",
              approve: true,
            },
            financialActorId,
          );
          await expectPostgresCode(
            sql`
              INSERT INTO product_financial_costs (
                variation_id, policy_id, artist_cost_in_cents,
                commercial_addition_in_cents, owner_share_in_cents,
                organizer_share_in_cents, rounding_residual_in_cents,
                commercial_base_in_cents, calculation_version
              ) VALUES (
                ${variation.id}, ${policy.id}, 10000,
                5000, 2500, 2500, 0, 15000, 'invalid-split-probe'
              )
            `,
            "23514",
          );
          await assert.rejects(
            saveProductFinancialPricing(
              database,
              {
                productId: product.id,
                variationId: null,
                artistCostInCents: 10_000,
                policyId: policy.id,
                paymentMethod: "pix",
                paymentFeeRuleId: expiredPaymentRule.id,
                taxRuleId: taxRule.id,
                isDefault: true,
              },
              financialActorId,
            ),
            (error) =>
              error instanceof AdminOperationError &&
              error.code === "INVALID_INPUT",
          );
          const financial = await saveProductFinancialPricing(
            database,
            {
              productId: product.id,
              variationId: null,
              artistCostInCents: 10_000,
              policyId: policy.id,
              paymentMethod: "pix",
              paymentFeeRuleId: paymentRule.id,
              taxRuleId: taxRule.id,
              isDefault: true,
            },
            financialActorId,
          );
          assert.ok(financial.scenario);
          await validateProductPricingScenario(
            database,
            financial.scenario.id,
            financialActorId,
          );
          const auditRows = await sql<{ id: string }[]>`
            SELECT id
            FROM financial_audit_events
            WHERE actor_user_id = ${financialActorId}
            ORDER BY created_at
          `;
          assert.ok(auditRows.length >= 6);
          const auditEventId = auditRows[0]?.id;
          assert.ok(auditEventId);
          await expectPostgresCode(
            sql`
              UPDATE financial_audit_events
              SET action = action || '.tamper'
              WHERE id = ${auditEventId}
            `,
            "23514",
          );
          await expectPostgresCode(
            sql`
              UPDATE product_financial_costs
              SET artist_cost_in_cents = artist_cost_in_cents + 1
              WHERE id = ${financial.cost.id}
            `,
            "23514",
          );
          await expectPostgresCode(
            sql`
              DELETE FROM financial_audit_events
              WHERE entity_id = ${financial.cost.id}
            `,
            "23514",
          );
          await sql`
            UPDATE product_variations
            SET specific_price_in_cents = 25000
            WHERE id = ${variation.id}
          `;
          await assert.rejects(
            setProductPublicationStatus(database, product.id, "published"),
            (error) =>
              error instanceof AdminOperationError &&
              error.code === "INVALID_INPUT",
          );
          await sql`
            UPDATE product_variations
            SET specific_price_in_cents = NULL
            WHERE id = ${variation.id}
          `;
          await setProductPublicationStatus(database, product.id, "published");
          const published = await getProductDetail(database, product.id);
          assert.equal(published?.product.publicationStatus, "published");
          assert.equal(published?.images.length, 1);
          assert.ok(published?.shippingProfile);

          const secondProduct = await createProduct(database, {
            name: "Azulejo de Integração",
            slug: "azulejo-integracao",
            description: "Azulejo autoral usado somente no teste descartável.",
            artistId: artist.id,
            categoryIds: [child.id],
            material: "Cerâmica",
            productionTechnique: "Pintura manual",
            priceInCents: 0,
            publicationStatus: "draft",
          });
          assert.ok(secondProduct);
          await createVariation(database, {
            productId: secondProduct.id,
            sku: "AZULEJO-INTEGRACAO-01",
            color: "Azul",
            size: "Único",
            availableQuantity: 0,
            specificPriceInCents: null,
            isActive: true,
            isDefault: true,
          });
          await addProductImageMetadata(database, {
            productId: secondProduct.id,
            filePath: `catalog/${secondProduct.id}/azulejo.webp`,
            altText: "Azulejo de integração sobre fundo neutro",
            displayOrder: 0,
            isPrimary: true,
          });
          const secondFinancial = await saveProductFinancialPricing(
            database,
            {
              productId: secondProduct.id,
              variationId: null,
              artistCostInCents: 20_000,
              policyId: policy.id,
              paymentMethod: "pix",
              paymentFeeRuleId: paymentRule.id,
              taxRuleId: taxRule.id,
              isDefault: true,
            },
            financialActorId,
          );
          assert.ok(secondFinancial.scenario);
          await validateProductPricingScenario(
            database,
            secondFinancial.scenario.id,
            financialActorId,
          );
          await setProductPublicationStatus(
            database,
            secondProduct.id,
            "published",
          );

          const publicItems = await listPersistedPublishedProducts(database);
          assert.deepEqual(
            new Set(publicItems.map((item) => item.id)),
            new Set([product.id, secondProduct.id]),
          );
          assert.equal("artistCostInCents" in publicItems[0], false);
          assert.equal("ownerShareInCents" in publicItems[0], false);
          assert.equal("organizerShareInCents" in publicItems[0], false);
          assert.equal("expectedTaxInCents" in publicItems[0], false);

          const searchBase = {
            query: "",
            category: null,
            artist: null,
            availability: "all" as const,
            sort: "newest" as const,
            page: 1,
            pageSize: 12,
          };
          const searched = await searchPersistedPublishedProducts(database, {
            ...searchBase,
            query: "Vaso",
          });
          assert.deepEqual(
            searched.rows.map((item) => item.id),
            [product.id],
          );
          const parentCategoryProducts =
            await searchPersistedPublishedProducts(database, {
              ...searchBase,
              category: parent.slug,
            });
          assert.equal(parentCategoryProducts.total, 2);
          const artistProducts = await searchPersistedPublishedProducts(
            database,
            { ...searchBase, artist: artist.id },
          );
          assert.equal(artistProducts.total, 2);
          const inStock = await searchPersistedPublishedProducts(database, {
            ...searchBase,
            availability: "in-stock",
          });
          assert.deepEqual(inStock.rows.map((item) => item.id), [product.id]);
          const outOfStock = await searchPersistedPublishedProducts(database, {
            ...searchBase,
            availability: "out-of-stock",
          });
          assert.deepEqual(outOfStock.rows.map((item) => item.id), [secondProduct.id]);
          const byPrice = await searchPersistedPublishedProducts(database, {
            ...searchBase,
            sort: "price-asc",
          });
          assert.deepEqual(
            byPrice.rows.map((item) => item.id),
            [product.id, secondProduct.id],
          );
          const firstPage = await searchPersistedPublishedProducts(database, {
            ...searchBase,
            sort: "name-asc",
            pageSize: 1,
          });
          assert.equal(firstPage.total, 2);
          assert.equal(firstPage.totalPages, 2);
          assert.deepEqual(firstPage.rows.map((item) => item.id), [secondProduct.id]);

          const publicDetail = await getPersistedPublishedProductBySlug(
            database,
            product.slug,
          );
          assert.equal(publicDetail?.priceInCents, published?.product.priceInCents);
          assert.equal(publicDetail?.availableQuantity, 3);
          assert.equal(publicDetail?.variations.length, 1);
          assert.ok(publicDetail?.images.every((image) => image.src === null));
          assert.equal("artistCostInCents" in (publicDetail ?? {}), false);
          assert.equal(
            await getPersistedPublishedProductBySlug(database, "inexistente"),
            null,
          );

          const visibleCategories = await listPersistedVisibleCategories(database);
          assert.equal(
            visibleCategories.find((item) => item.id === parent.id)?.productCount,
            2,
          );
          assert.equal(
            visibleCategories.find((item) => item.id === child.id)?.parentId,
            parent.id,
          );
          const publicArtist = await getPersistedActiveArtistBySegment(
            database,
            artist.id,
          );
          assert.equal(publicArtist?.productCount, 2);

          await setProductPublicationStatus(
            database,
            secondProduct.id,
            "archived",
          );
          assert.deepEqual(
            (await listPersistedPublishedProducts(database)).map((item) => item.id),
            [product.id],
          );

          const editedVariation = await updateVariation(
            database,
            variation.id,
            {
              productId: product.id,
              sku: variation.sku,
              color: "Terracota",
              size: variation.size,
              availableQuantity: 999,
              specificPriceInCents: null,
              isActive: true,
              isDefault: true,
            },
          );
          assert.equal(editedVariation?.color, "Terracota");
          assert.equal(editedVariation?.availableQuantity, 3);

          const updatedStock = await updateVariationStock(database, {
            variationId: variation.id,
            availableQuantity: 2,
            expectedAvailableQuantity: editedVariation?.availableQuantity ?? 3,
            expectedUpdatedAt: editedVariation?.updatedAt ?? variation.updatedAt,
          });
          assert.equal(updatedStock.availableQuantity, 2);
          await assert.rejects(
            updateVariationStock(database, {
              variationId: variation.id,
              availableQuantity: 1,
              expectedAvailableQuantity: editedVariation?.availableQuantity ?? 3,
              expectedUpdatedAt: editedVariation?.updatedAt ?? variation.updatedAt,
            }),
            (error) =>
              error instanceof AdminOperationError && error.code === "CONFLICT",
          );

          await assert.rejects(
            updateCategory(database, parent.id, {
              name: parent.name,
              slug: parent.slug,
              description: parent.description,
              parentId: child.id,
              displayOrder: parent.displayOrder,
            }),
            (error) => error instanceof AdminOperationError,
          );
          await assert.rejects(
            deleteCategory(database, child.id),
            (error) =>
              error instanceof AdminOperationError &&
              error.code === "RELATION_PROTECTED",
          );
          await setArtistActive(database, artist.id, false);
          assert.equal(
            await getPersistedActiveArtistBySegment(database, artist.id),
            null,
          );
          assert.ok(await getProductDetail(database, product.id));
          await setProductPublicationStatus(database, product.id, "archived");
          assert.equal(
            (await listPersistedPublishedProducts(database)).length,
            0,
          );

          const emailTransport = new MemoryAuthEmailTransport();
          const auth = createCollabAuth({
            database,
            baseURL: authBaseURL,
            secret: "collab-admin-isolated-test-secret-32-chars",
            emailTransport,
            publicSignupEnabled: false,
          });
          const adminEmail = `admin-isolado-${randomUUID()}@example.com`;
          const adminPassword = "admin-isolado-teste-2026"; // gitleaks:allow -- fixture local, sem valor real.
          const adminIpAddress = "192.0.2.77";
          const provisioned = await auth.api.createUser({
            body: {
              name: "Admin Isolado",
              email: adminEmail,
              password: adminPassword,
              role: "ADMIN",
              data: {
                emailVerified: true,
                banned: false,
                banReason: null,
                banExpires: null,
              },
            },
          });
          assert.equal(provisioned.user.role, "ADMIN");
          assert.equal(provisioned.user.emailVerified, true);
          const login = await authRequest(auth, "/sign-in/email", {
            body: { email: adminEmail, password: adminPassword },
            ipAddress: adminIpAddress,
          });
          assert.equal(login.status, 200);
          const adminResponse = await authRequest(auth, "/admin/list-users", {
            method: "GET",
            cookie: readSessionCookie(login),
            ipAddress: adminIpAddress,
          });
          assert.equal(adminResponse.status, 200);
        },
      );

      await t.test("aplica rate limit ao login", async () => {
        await resetIsolatedDatabase(sql);
        await runMigrations(runnerOptions());

        const auth = createCollabAuth({
          database: drizzle({ client: sql, schema }),
          baseURL: authBaseURL,
          secret: "collab-rate-limit-test-secret-with-32-chars",
          emailTransport: new MemoryAuthEmailTransport(),
          publicSignupEnabled: true,
        });
        const statuses: number[] = [];
        for (let attempt = 0; attempt < 9; attempt += 1) {
          const response = await authRequest(auth, "/sign-in/email", {
            body: {
              email: "rate-limit@example.com",
              password: "tentativa-invalida-2026",
            },
            ipAddress: "192.0.2.9",
          });
          statuses.push(response.status);
        }

        assert.equal(statuses.at(-1), 429);
        assert.equal(statuses.slice(0, 8).includes(429), false);
      });

      await t.test("rejeita migration alterada depois da aplicação", async () => {
        await resetIsolatedDatabase(sql);
        const id = "9000_checksum_probe";
        const directory = await createMigrationFixture(
          id,
          "CREATE TABLE checksum_probe (id integer PRIMARY KEY);",
        );

        try {
          await runMigrations(runnerOptions(directory));
          await writeMigrationFixture(
            directory,
            id,
            "CREATE TABLE checksum_probe (id bigint PRIMARY KEY);",
          );
          await expectRunnerCode(
            runMigrations(runnerOptions(directory)),
            "CHECKSUM_MISMATCH",
          );
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });

      await t.test("rejeita manifesto inválido antes de conectar", async () => {
        const id = "9001_invalid_manifest";
        const directory = await createMigrationFixture(id, "SELECT 1;");

        try {
          const manifestPath = path.join(directory, "manifest.json");
          await writeFile(
            manifestPath,
            `${JSON.stringify(
              {
                formatVersion: 1,
                migrations: [
                  { id, file: `${id}.sql`, sha256: "0".repeat(64) },
                ],
              },
              null,
              2,
            )}\n`,
            "utf8",
          );
          await expectRunnerCode(
            runMigrations(runnerOptions(directory)),
            "MANIFEST_INVALID",
          );
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });

      await t.test("reverte DDL e ledger quando uma migration falha", async () => {
        await resetIsolatedDatabase(sql);
        const directory = await createMigrationFixture(
          "9002_rollback_probe",
          "CREATE TABLE rollback_probe (id integer); SELECT 1 / 0;",
        );

        try {
          await expectRunnerCode(
            runMigrations(runnerOptions(directory)),
            "MIGRATION_FAILED",
          );
          const objects = await sql<
            { probe: string | null; ledger: string | null }[]
          >`
            SELECT
              to_regclass('public.rollback_probe')::text AS probe,
              to_regclass('public.collab_schema_migrations')::text AS ledger
          `;
          assert.deepEqual(objects[0], { probe: null, ledger: null });
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });

      await t.test("serializa dois runners concorrentes sem duplicar", async () => {
        await resetIsolatedDatabase(sql);
        const directory = await createMigrationFixture(
          "9003_concurrent_runner",
          "CREATE TABLE concurrent_runner_probe (id integer); SELECT pg_sleep(0.4);",
        );

        try {
          const reports = await Promise.all([
            runMigrations(runnerOptions(directory)),
            runMigrations(runnerOptions(directory)),
          ]);
          assert.deepEqual(
            reports.map((report) => report.applied.length).sort(),
            [0, 1],
          );
          assert.deepEqual(
            reports.map((report) => report.skipped.length).sort(),
            [0, 1],
          );
          const ledger = await sql<{ total: number }[]>`
            SELECT count(*)::integer AS total
            FROM collab_schema_migrations
          `;
          assert.equal(ledger[0]?.total, 1);
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });

      await t.test("não registra migration após interrupção da conexão", async () => {
        await resetIsolatedDatabase(sql);
        const directory = await createMigrationFixture(
          "9004_connection_interruption",
          "CREATE TABLE interrupted_runner_probe (id integer);",
        );

        try {
          await expectRunnerCode(
            runMigrations({
              ...runnerOptions(directory),
              onLockAcquired: async ({ backendPid }) => {
                const result = await sql<{ terminated: boolean }[]>`
                  SELECT pg_terminate_backend(${backendPid}) AS terminated
                `;
                assert.equal(result[0]?.terminated, true);
              },
            }),
            "RUNNER_FAILED",
          );
          const objects = await sql<
            { probe: string | null; ledger: string | null }[]
          >`
            SELECT
              to_regclass('public.interrupted_runner_probe')::text AS probe,
              to_regclass('public.collab_schema_migrations')::text AS ledger
          `;
          assert.deepEqual(objects[0], { probe: null, ledger: null });
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

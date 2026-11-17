import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import postgres, { type Sql } from "postgres";

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

        assert.deepEqual(firstRun.applied, ["0000_collab_catalog"]);
        assert.deepEqual(firstRun.skipped, []);
        assert.deepEqual(secondRun.applied, []);
        assert.deepEqual(secondRun.skipped, ["0000_collab_catalog"]);
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
            "artists",
            "categories",
            "collab_schema_migrations",
            "customer_addresses",
            "product_categories",
            "product_images",
            "product_variations",
            "products",
            "shipping_profiles",
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
            "collab_assert_product_publishable",
            "collab_prevent_category_cycle",
            "collab_set_updated_at",
            "collab_validate_product_dependencies",
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
        assert.equal(triggers.length, 12);

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
        assert.ok((constraintTotals.get("p") ?? 0) >= 9);
        assert.ok((constraintTotals.get("f") ?? 0) >= 8);
        assert.ok((constraintTotals.get("c") ?? 0) >= 20);

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
              12000,
              'published',
              now()
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

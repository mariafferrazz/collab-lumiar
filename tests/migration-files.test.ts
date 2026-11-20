import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const migrationsDirectory = path.join(projectRoot, "drizzle");
const catalogMigrationFile = "0000_collab_catalog.sql";
const authMigrationFile = "0001_collab_auth.sql";
const financialMigrationFile = "0002_collab_financial_pricing.sql";

interface MigrationManifest {
  formatVersion: number;
  migrations: Array<{
    id: string;
    file: string;
    sha256: string;
  }>;
}

async function readMigration(file = catalogMigrationFile) {
  return readFile(path.join(migrationsDirectory, file), "utf8");
}

test("mantém checksums e ordem das migrations no manifesto", async () => {
  const [catalogSql, authSql, financialSql, manifestContents] =
    await Promise.all([
      readFile(path.join(migrationsDirectory, catalogMigrationFile)),
      readFile(path.join(migrationsDirectory, authMigrationFile)),
      readFile(path.join(migrationsDirectory, financialMigrationFile)),
      readFile(path.join(migrationsDirectory, "manifest.json"), "utf8"),
    ]);
  const manifest = JSON.parse(manifestContents) as MigrationManifest;

  assert.equal(manifest.formatVersion, 1);
  assert.deepEqual(
    manifest.migrations.map(({ id, file }) => ({ id, file })),
    [
      { id: "0000_collab_catalog", file: catalogMigrationFile },
      { id: "0001_collab_auth", file: authMigrationFile },
      { id: "0002_collab_financial_pricing", file: financialMigrationFile },
    ],
  );
  assert.equal(
    manifest.migrations[0]?.sha256,
    createHash("sha256").update(catalogSql).digest("hex"),
  );
  assert.equal(
    manifest.migrations[0]?.sha256,
    "1ce1576bf47f998a8444487d9e4ea1541f1b8f247636b3f5676b901373b09527",
  );
  assert.equal(
    manifest.migrations[1]?.sha256,
    createHash("sha256").update(authSql).digest("hex"),
  );
  assert.equal(
    manifest.migrations[2]?.sha256,
    createHash("sha256").update(financialSql).digest("hex"),
  );
});

test("migration cria somente as oito tabelas de domínio", async () => {
  const sql = await readMigration();
  const tableNames = [...sql.matchAll(/^CREATE TABLE "([^"]+)"/gm)].map(
    (match) => match[1],
  );

  assert.deepEqual(tableNames, [
    "artists",
    "categories",
    "products",
    "product_categories",
    "product_variations",
    "product_images",
    "shipping_profiles",
    "customer_addresses",
  ]);
  assert.doesNotMatch(
    sql,
    /^CREATE TABLE "(?:user|session|account|verification)"/gm,
  );
});

test("migration inclui proteções de hierarquia, publicação e auditoria", async () => {
  const sql = await readMigration();

  assert.match(sql, /CREATE FUNCTION "collab_prevent_category_cycle"/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /CREATE FUNCTION "collab_assert_product_publishable"/);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/g);
  assert.match(sql, /CREATE FUNCTION "collab_set_updated_at"/);
  assert.equal([...sql.matchAll(/BEFORE UPDATE ON "/g)].length, 7);
  assert.match(sql, /product_variations_default_product_unique/);
  assert.match(sql, /product_images_primary_product_unique/);
});

test("migration inicial não contém DML, alteração destrutiva ou credencial", async () => {
  const sql = await readMigration();

  assert.doesNotMatch(
    sql,
    /^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/gim,
  );
  assert.doesNotMatch(sql, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(sql, /DATABASE_URL|PASSWORD|ACCESS_TOKEN/i);
});

test("migration de autenticação segue o schema oficial UUID", async () => {
  const sql = await readMigration(authMigrationFile);
  const tableNames = [...sql.matchAll(/^CREATE TABLE "([^"]+)"/gmu)].map(
    (match) => match[1],
  );

  assert.deepEqual(tableNames, ["user", "session", "account", "verification"]);
  assert.match(sql, /"id" uuid PRIMARY KEY/gmu);
  assert.match(sql, /"user_id" uuid NOT NULL/gmu);
  assert.match(sql, /"role" text DEFAULT 'CUSTOMER' NOT NULL/u);
  assert.match(sql, /CHECK \("role" IN \('CUSTOMER', 'ADMIN'\)\)/u);
  assert.match(sql, /customer_addresses_user_id_user_id_fk/u);
  assert.match(sql, /ON DELETE CASCADE/u);
  assert.doesNotMatch(sql, /^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/gimu);
  assert.doesNotMatch(sql, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(sql, /DATABASE_URL|BETTER_AUTH_SECRET/iu);
});

test("migration financeira preserva o acordo e exige histórico auditável", async () => {
  const sql = await readMigration(financialMigrationFile);
  const tableNames = [...sql.matchAll(/^CREATE TABLE "([^"]+)"/gmu)].map(
    (match) => match[1],
  );
  assert.deepEqual(tableNames, [
    "financial_pricing_policies",
    "financial_charge_rules",
    "product_financial_costs",
    "product_pricing_scenarios",
    "financial_audit_events",
  ]);
  assert.match(sql, /commercial_markup_basis_points" = 4000/u);
  assert.match(sql, /owner_share_basis_points" = 5000/u);
  assert.match(sql, /organizer_share_basis_points" = 5000/u);
  assert.match(sql, /product_financial_costs_fixed_agreement/u);
  assert.match(sql, /payment_method" IS DISTINCT FROM NEW\."payment_method/u);
  assert.match(sql, /c\."id" IS NULL OR s\."id" IS NULL/u);
  assert.match(sql, /collab_protect_financial_history/u);
  assert.match(sql, /collab_assert_product_financially_publishable/u);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/gu);
  assert.doesNotMatch(sql, /^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/gimu);
  assert.doesNotMatch(sql, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(sql, /ACCESS_TOKEN|DATABASE_URL|PASSWORD/iu);
});

test("preflight aceita somente marcador development com URL de loopback", () => {
  const scriptPath = path.join(
    projectRoot,
    "scripts",
    "db-migrations-check.mjs",
  );
  const safeEnvironment = {
    ...process.env,
    DATABASE_ENVIRONMENT: "development",
    DATABASE_URL: "postgresql://placeholder@127.0.0.1:5432/placeholder",
  };
  const safeResult = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    encoding: "utf8",
    env: safeEnvironment,
  });

  assert.equal(safeResult.status, 0, safeResult.stderr);
  assert.match(safeResult.stdout, /nenhuma conexão foi aberta/);

  const unsafeResult = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...safeEnvironment,
      DATABASE_URL: "postgresql://placeholder@db.example.invalid/placeholder",
    },
  });

  assert.notEqual(unsafeResult.status, 0);
  assert.match(unsafeResult.stderr, /túnel local de development/);
  assert.doesNotMatch(
    `${unsafeResult.stdout}${unsafeResult.stderr}`,
    /placeholder@|db\.example\.invalid/,
  );
});

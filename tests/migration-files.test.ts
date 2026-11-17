import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const migrationsDirectory = path.join(projectRoot, "drizzle");
const migrationFile = "0000_collab_catalog.sql";

interface MigrationManifest {
  formatVersion: number;
  migrations: Array<{
    id: string;
    file: string;
    sha256: string;
  }>;
}

async function readMigration() {
  return readFile(path.join(migrationsDirectory, migrationFile), "utf8");
}

test("mantém checksum e ordem da migration no manifesto", async () => {
  const [sql, manifestContents] = await Promise.all([
    readFile(path.join(migrationsDirectory, migrationFile)),
    readFile(path.join(migrationsDirectory, "manifest.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestContents) as MigrationManifest;

  assert.equal(manifest.formatVersion, 1);
  assert.deepEqual(
    manifest.migrations.map(({ id, file }) => ({ id, file })),
    [{ id: "0000_collab_catalog", file: migrationFile }],
  );
  assert.equal(
    manifest.migrations[0]?.sha256,
    createHash("sha256").update(sql).digest("hex"),
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

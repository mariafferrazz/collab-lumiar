import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const TRANSACTION_UNSAFE_STATEMENTS = [
  /^BEGIN\b/i,
  /^START\s+TRANSACTION\b/i,
  /^COMMIT\b/i,
  /^ROLLBACK\b/i,
  /^CREATE\s+DATABASE\b/i,
  /^DROP\s+DATABASE\b/i,
  /^CREATE\s+TABLESPACE\b/i,
  /^DROP\s+TABLESPACE\b/i,
  /^ALTER\s+SYSTEM\b/i,
  /^VACUUM\b/i,
  /^CLUSTER\b/i,
  /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i,
  /^DROP\s+INDEX\s+CONCURRENTLY\b/i,
  /^REINDEX\b[\s\S]*\bCONCURRENTLY\b/i,
  /^REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\b/i,
];

function fail(message) {
  throw new Error(message);
}

function stripLeadingComments(statement) {
  return statement
    .replace(/^\s*(?:--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/\s*)*/u, "")
    .trim();
}

export function assertMigrationIsTransactional(migrationId, sql) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map(stripLeadingComments)
    .filter(Boolean);

  if (statements.length === 0) {
    fail(`Migration vazia: ${migrationId}.`);
  }

  for (const statement of statements) {
    if (
      TRANSACTION_UNSAFE_STATEMENTS.some((pattern) => pattern.test(statement))
    ) {
      fail(`Migration não transacional detectada: ${migrationId}.`);
    }
  }
}

export async function loadVerifiedMigrations(migrationsDirectory) {
  const manifestPath = path.join(migrationsDirectory, "manifest.json");
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail("Manifesto de migrations ausente ou inválido.");
  }

  if (
    manifest?.formatVersion !== 1 ||
    !Array.isArray(manifest.migrations) ||
    manifest.migrations.length === 0
  ) {
    fail("Manifesto de migrations inválido.");
  }

  const ids = new Set();
  const files = new Set();
  const verifiedMigrations = [];
  let previousId = "";

  for (const migration of manifest.migrations) {
    if (
      typeof migration?.id !== "string" ||
      typeof migration.file !== "string" ||
      typeof migration.sha256 !== "string" ||
      !SHA256_PATTERN.test(migration.sha256)
    ) {
      fail("Entrada inválida no manifesto de migrations.");
    }

    if (
      path.basename(migration.file) !== migration.file ||
      !MIGRATION_FILE_PATTERN.test(migration.file) ||
      migration.id !== migration.file.replace(/\.sql$/, "")
    ) {
      fail("Nome de migration inválido no manifesto.");
    }

    if (
      ids.has(migration.id) ||
      files.has(migration.file) ||
      migration.id <= previousId
    ) {
      fail("Migrations duplicadas ou fora de ordem no manifesto.");
    }

    const migrationPath = path.join(migrationsDirectory, migration.file);
    const contents = await readFile(migrationPath);
    const actualHash = createHash("sha256").update(contents).digest("hex");

    if (actualHash !== migration.sha256) {
      fail(`Checksum divergente para ${migration.id}.`);
    }

    const sql = contents.toString("utf8");
    assertMigrationIsTransactional(migration.id, sql);

    verifiedMigrations.push({
      id: migration.id,
      file: migration.file,
      sha256: migration.sha256,
      sql,
    });
    ids.add(migration.id);
    files.add(migration.file);
    previousId = migration.id;
  }

  return verifiedMigrations;
}

export async function verifyMigrationManifest(migrationsDirectory) {
  return (await loadVerifiedMigrations(migrationsDirectory)).length;
}

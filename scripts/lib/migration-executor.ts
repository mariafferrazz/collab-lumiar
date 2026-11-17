import type { TransactionSql } from "postgres";

export const LEDGER_TABLE = "collab_schema_migrations" as const;
const RUNNER_VERSION = 1;
const ADVISORY_LOCK_KEYS = [1129270348, 1296648018] as const;

export interface VerifiedMigration {
  id: string;
  file: string;
  sha256: string;
  sql: string;
}

interface LedgerRow {
  migration_id: string;
  checksum_sha256: string;
}

export interface MigrationExecutionReport {
  applied: string[];
  skipped: string[];
  ledgerTable: typeof LEDGER_TABLE;
}

export interface MigrationExecutionOptions {
  onLockAcquired?: (context: { backendPid: number }) => Promise<void> | void;
  raise: (code: string, message: string, cause?: unknown) => never;
}

async function createAndReadLedger(
  transaction: TransactionSql,
): Promise<LedgerRow[]> {
  await transaction.unsafe(`
    CREATE TABLE IF NOT EXISTS "${LEDGER_TABLE}" (
      "migration_id" text PRIMARY KEY,
      "checksum_sha256" char(64) NOT NULL,
      "runner_version" integer NOT NULL,
      "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "collab_schema_migrations_checksum_format"
        CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$'),
      CONSTRAINT "collab_schema_migrations_runner_version_positive"
        CHECK ("runner_version" > 0)
    )
  `);

  return transaction<LedgerRow[]>`
    SELECT
      migration_id,
      btrim(checksum_sha256) AS checksum_sha256
    FROM collab_schema_migrations
    ORDER BY migration_id
  `;
}

export async function executeVerifiedMigrations(
  transaction: TransactionSql,
  migrations: VerifiedMigration[],
  options: MigrationExecutionOptions,
): Promise<MigrationExecutionReport> {
  await transaction`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEYS[0]}, ${ADVISORY_LOCK_KEYS[1]})`;

  const ledgerRows = await createAndReadLedger(transaction);
  const migrationsById = new Map(
    migrations.map((migration) => [migration.id, migration]),
  );

  for (const ledgerRow of ledgerRows) {
    if (!migrationsById.has(ledgerRow.migration_id)) {
      options.raise(
        "LEDGER_DIVERGED",
        `O ledger contém uma migration ausente do manifesto: ${ledgerRow.migration_id}.`,
      );
    }
  }

  const backendRows = await transaction<{ backend_pid: number }[]>`
    SELECT pg_backend_pid() AS backend_pid
  `;
  const backendPid = backendRows[0]?.backend_pid;

  if (!backendPid) {
    options.raise("TARGET_REJECTED", "Backend PostgreSQL não identificado.");
  }

  await options.onLockAcquired?.({ backendPid });

  const applied: string[] = [];
  const skipped: string[] = [];
  const ledgerById = new Map(
    ledgerRows.map((row) => [row.migration_id, row.checksum_sha256]),
  );

  for (const migration of migrations) {
    const appliedChecksum = ledgerById.get(migration.id);

    if (appliedChecksum) {
      if (appliedChecksum !== migration.sha256) {
        options.raise(
          "CHECKSUM_MISMATCH",
          `Migration aplicada foi modificada: ${migration.id}.`,
        );
      }

      skipped.push(migration.id);
      continue;
    }

    try {
      await transaction.unsafe(migration.sql);
    } catch (error) {
      options.raise(
        "MIGRATION_FAILED",
        `A migration ${migration.id} falhou e foi revertida.`,
        error,
      );
    }

    await transaction`
      INSERT INTO collab_schema_migrations (
        migration_id,
        checksum_sha256,
        runner_version
      )
      VALUES (
        ${migration.id},
        ${migration.sha256},
        ${RUNNER_VERSION}
      )
    `;
    applied.push(migration.id);
  }

  return { applied, skipped, ledgerTable: LEDGER_TABLE };
}

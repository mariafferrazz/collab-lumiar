import path from "node:path";

import postgres from "postgres";

import {
  assertDevelopmentTarget,
  DEVELOPMENT_POSTGRES_MAJOR,
  developmentDatabaseFingerprint,
  migrationManifestSha256,
  requiredDevelopmentApproval,
} from "./lib/development-migration-guard";
import type { VerifiedMigration } from "./lib/migration-executor";
import { loadVerifiedMigrations } from "./lib/migration-manifest.mjs";
import { summarizeMigrationObjects } from "./lib/migration-plan.mjs";

interface IdentityRow {
  database_name: string;
  database_user: string;
  server_version: string;
  server_version_number: number;
  system_identifier: string;
}

interface LedgerRow {
  migration_id: string;
  checksum_sha256: string;
}

async function main() {
  const parsedUrl = assertDevelopmentTarget({
    databaseUrl: process.env.COLLAB_DEVELOPMENT_DATABASE_URL,
    project: process.env.RAILWAY_PROJECT_NAME,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME,
    target: process.env.MIGRATION_TARGET,
  });
  const migrations = (await loadVerifiedMigrations(
    path.resolve(process.cwd(), "drizzle"),
  )) as VerifiedMigration[];
  const manifestSha256 = migrationManifestSha256(migrations);
  const client = postgres(parsedUrl.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => undefined,
  });

  try {
    const observation = await client.begin(async (transaction) => {
      await transaction.unsafe("SET TRANSACTION READ ONLY");
      const identityRows = await transaction<IdentityRow[]>`
        SELECT
          current_database() AS database_name,
          current_user AS database_user,
          current_setting('server_version') AS server_version,
          current_setting('server_version_num')::integer AS server_version_number,
          pg_control_system.system_identifier::text AS system_identifier
        FROM pg_control_system()
      `;
      const identity = identityRows[0];

      if (!identity) {
        throw new Error("Identidade do PostgreSQL não foi retornada.");
      }

      const ledgerExistsRows = await transaction<{ ledger_exists: boolean }[]>`
        SELECT to_regclass('public.collab_schema_migrations') IS NOT NULL
          AS ledger_exists
      `;
      const ledgerExists = ledgerExistsRows[0]?.ledger_exists === true;
      const ledgerRows = ledgerExists
        ? await transaction<LedgerRow[]>`
            SELECT
              migration_id,
              btrim(checksum_sha256) AS checksum_sha256
            FROM collab_schema_migrations
            ORDER BY migration_id
          `
        : [];

      return { identity, ledgerExists, ledgerRows };
    });
    const observedMajor = Math.trunc(
      observation.identity.server_version_number / 10000,
    );

    if (observedMajor !== DEVELOPMENT_POSTGRES_MAJOR) {
      throw new Error(
        "A versão principal observada difere da versão isolada aprovada.",
      );
    }

    const manifestById = new Map(
      migrations.map((migration) => [migration.id, migration.sha256]),
    );

    for (const row of observation.ledgerRows) {
      if (manifestById.get(row.migration_id) !== row.checksum_sha256) {
        throw new Error("O ledger diverge do manifesto versionado.");
      }
    }

    const appliedIds = new Set(
      observation.ledgerRows.map((row) => row.migration_id),
    );
    const pending = migrations
      .filter((migration) => !appliedIds.has(migration.id))
      .map((migration) => migration.id);
    const fingerprint = developmentDatabaseFingerprint({
      systemIdentifier: observation.identity.system_identifier,
      databaseName: observation.identity.database_name,
      databaseUser: observation.identity.database_user,
      serverVersionNumber: observation.identity.server_version_number,
    });
    const objects = summarizeMigrationObjects(migrations);

    console.log(
      `[db:migrations:plan:development] PostgreSQL ${observation.identity.server_version}; consulta somente leitura aprovada.`,
    );
    console.log(
      `[db:migrations:plan:development] Fingerprint SHA-256: ${fingerprint}.`,
    );
    console.log(
      `[db:migrations:plan:development] Ledger: ${observation.ledgerExists ? `${observation.ledgerRows.length} registro(s)` : "ausente"}.`,
    );
    console.log(
      `[db:migrations:plan:development] Pendentes: ${pending.join(", ") || "nenhuma"}.`,
    );
    console.log(
      `[db:migrations:plan:development] Tabelas planejadas: ${objects.tables.join(", ")}.`,
    );
    console.log(
      `[db:migrations:plan:development] Índices ${objects.indexes.length}; funções ${objects.functions.length}; triggers ${objects.triggers.length}.`,
    );
    console.log(
      `[db:migrations:plan:development] Autorização futura: ${requiredDevelopmentApproval(manifestSha256)}`,
    );
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `[db:migrations:plan:development] ${error.message}`
      : "[db:migrations:plan:development] Falha segura no preflight.",
  );
  process.exitCode = 1;
});

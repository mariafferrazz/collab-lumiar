import { DevelopmentMigrationGuardError } from "./lib/development-migration-guard";
import {
  DevelopmentMigrationRunnerError,
  runDevelopmentMigrations,
} from "./lib/development-migration-runner";

async function main() {
  const report = await runDevelopmentMigrations({
    databaseUrl: process.env.COLLAB_DEVELOPMENT_DATABASE_URL,
    project: process.env.RAILWAY_PROJECT_NAME,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME,
    target: process.env.MIGRATION_TARGET,
    expectedFingerprint: process.env.COLLAB_DEVELOPMENT_DB_FINGERPRINT,
    backupEvidencePath: process.env.COLLAB_BACKUP_EVIDENCE_PATH,
    approval: process.env.COLLAB_MIGRATION_APPROVAL,
  });

  console.log(
    `[db:migrate:development] PostgreSQL ${report.serverVersion}; ` +
      `${report.applied.length} aplicada(s), ${report.skipped.length} já registrada(s).`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof DevelopmentMigrationRunnerError ||
      error instanceof DevelopmentMigrationGuardError
      ? `[db:migrate:development] ${error.message}`
      : "[db:migrate:development] Falha segura; detalhes suprimidos.",
  );
  process.exitCode = 1;
});

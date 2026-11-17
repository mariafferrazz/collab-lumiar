import { MigrationRunnerError, runMigrations } from "./lib/migration-runner";

async function main() {
  const report = await runMigrations({
    databaseUrl: process.env.COLLAB_TEST_DATABASE_URL,
    environment: process.env.DATABASE_ENVIRONMENT,
    target: process.env.MIGRATION_TARGET,
  });

  console.log(
    `[db:migrate:test] PostgreSQL ${report.serverVersion}; ` +
      `${report.applied.length} aplicada(s), ${report.skipped.length} já registrada(s).`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof MigrationRunnerError
      ? `[db:migrate:test] ${error.message}`
      : "[db:migrate:test] Falha segura; detalhes suprimidos.",
  );
  process.exitCode = 1;
});

import { readLocalAdminEnvironment } from "./lib/local-admin-environment";
import {
  LocalAdminMigrationError,
  runLocalAdminMigrations,
} from "./lib/local-admin-migration-runner";

async function main() {
  const { environment } = await readLocalAdminEnvironment();
  const report = await runLocalAdminMigrations(environment);
  const applied = report.applied.length ? report.applied.join(", ") : "nenhuma";

  console.log(
    `[local-admin:migrate] PostgreSQL ${report.serverVersion}; ` +
      `aplicadas: ${applied}; já registradas: ${report.skipped.length}.`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof LocalAdminMigrationError
      ? `[local-admin:migrate] ${error.message}`
      : "[local-admin:migrate] Falha segura; detalhes suprimidos.",
  );
  process.exitCode = 1;
});

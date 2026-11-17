import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyMigrationManifest } from "./lib/migration-manifest.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function fail(message) {
  throw new Error(message);
}

export function assertSafeDevelopmentEnvironment(environment, databaseUrl) {
  if (environment !== "development") {
    fail("DATABASE_ENVIRONMENT deve ser exatamente development.");
  }

  if (!databaseUrl) {
    fail("DATABASE_URL não está configurada.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL não é uma URL PostgreSQL válida.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsedUrl.protocol)) {
    fail("DATABASE_URL deve utilizar o protocolo PostgreSQL.");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

  if (!loopbackHosts.has(parsedUrl.hostname.toLowerCase())) {
    fail("DATABASE_URL deve apontar para o túnel local de development.");
  }
}

async function main() {
  assertSafeDevelopmentEnvironment(
    process.env.DATABASE_ENVIRONMENT,
    process.env.DATABASE_URL,
  );
  const migrationCount = await verifyMigrationManifest(
    path.join(projectRoot, "drizzle"),
  );

  console.log(
    `Preflight local aprovado: ${migrationCount} migration(s) íntegra(s); nenhuma conexão foi aberta.`,
  );
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Falha no preflight de migrations.",
    );
    process.exitCode = 1;
  });
}

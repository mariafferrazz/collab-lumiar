import path from "node:path";

import { loadVerifiedMigrations } from "./lib/migration-manifest.mjs";
import {
  migrationSetSha256,
  summarizeMigrationObjects,
} from "./lib/migration-plan.mjs";

function readOption(name) {
  const prefix = `--${name}=`;
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length);
}

async function main() {
  const migrations = await loadVerifiedMigrations(
    path.resolve(process.cwd(), "drizzle"),
  );
  const objects = summarizeMigrationObjects(migrations);
  const observedVersion = readOption("server-version") ?? "não consultada";
  const ledgerState = readOption("ledger-state") ?? "não consultado";
  const pending =
    ledgerState === "absent" ? migrations.map(({ id }) => id) : [];

  console.log(
    "[db:migrations:plan] Simulação offline; nenhuma conexão foi aberta.",
  );
  console.log(`[db:migrations:plan] PostgreSQL observado: ${observedVersion}.`);
  console.log(`[db:migrations:plan] Ledger observado: ${ledgerState}.`);
  console.log(
    `[db:migrations:plan] Migration pendente: ${pending.join(", ") || "confirmar no preflight somente leitura"}.`,
  );
  console.log(
    `[db:migrations:plan] Tabelas (${objects.tables.length}): ${objects.tables.join(", ")}.`,
  );
  console.log(
    `[db:migrations:plan] Índices (${objects.indexes.length}); funções (${objects.functions.length}); triggers (${objects.triggers.length}); enums (${objects.enumTypes.length}).`,
  );
  console.log(
    `[db:migrations:plan] Autorização futura vinculada ao manifesto: APPLY_COLLAB_DEVELOPMENT:${migrationSetSha256(migrations)}`,
  );
  console.log(
    "[db:migrations:plan] Recuperação: rollback transacional; backup custom verificado e restauração isolada obrigatórios.",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `[db:migrations:plan] ${error.message}`
      : "[db:migrations:plan] Falha segura na simulação.",
  );
  process.exitCode = 1;
});

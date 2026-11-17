import path from "node:path";

import postgres, { type TransactionSql } from "postgres";

import {
  executeVerifiedMigrations,
  type LEDGER_TABLE,
  type VerifiedMigration,
} from "./migration-executor";
import { loadVerifiedMigrations } from "./migration-manifest.mjs";

const DATABASE_MARKER = "COLLAB_ISOLATED_TEST_DATABASE";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

interface DatabaseIdentity {
  database_name: string;
  database_user: string;
  server_address: string | null;
  server_port: number;
  database_marker: string | null;
  server_version: string;
  server_version_number: number;
}

export interface MigrationRunnerOptions {
  databaseUrl: string | undefined;
  environment: string | undefined;
  target: string | undefined;
  migrationsDirectory?: string;
  onLockAcquired?: (context: { backendPid: number }) => Promise<void> | void;
}

export interface MigrationRunReport {
  applied: string[];
  skipped: string[];
  serverVersion: string;
  ledgerTable: typeof LEDGER_TABLE;
}

export class MigrationRunnerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MigrationRunnerError";
  }
}

function runnerError(code: string, message: string, cause?: unknown): never {
  throw new MigrationRunnerError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function databaseNameFromUrl(url: URL): string {
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  if (!databaseName || databaseName.includes("/")) {
    runnerError("TARGET_REJECTED", "Nome do banco de teste inválido.");
  }

  return databaseName;
}

function isPrivateOrLoopbackAddress(address: string | null): boolean {
  if (!address) {
    return false;
  }

  if (address === "::1" || address.startsWith("127.")) {
    return true;
  }

  if (address.startsWith("10.") || address.startsWith("192.168.")) {
    return true;
  }

  const match = /^172\.(\d{1,2})\./.exec(address);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function assertIsolatedTestTarget(
  environment: string | undefined,
  target: string | undefined,
  databaseUrl: string | undefined,
): URL {
  if (environment !== "test" || target !== "isolated-postgres") {
    runnerError(
      "TARGET_REJECTED",
      "O runner aceita somente o alvo explícito isolated-postgres em modo test.",
    );
  }

  if (!databaseUrl) {
    runnerError("TARGET_REJECTED", "URL do banco isolado ausente.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    runnerError("TARGET_REJECTED", "URL do banco isolado inválida.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsedUrl.protocol)) {
    runnerError("TARGET_REJECTED", "O banco isolado deve usar PostgreSQL.");
  }

  if (!LOOPBACK_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    runnerError(
      "TARGET_REJECTED",
      "O runner de teste aceita somente endpoint de loopback.",
    );
  }

  const databaseName = databaseNameFromUrl(parsedUrl);

  if (!/^collab_test_[a-z0-9_]+$/.test(databaseName)) {
    runnerError(
      "TARGET_REJECTED",
      "O banco descartável deve usar o prefixo collab_test_.",
    );
  }

  if (!/^collab_test_[a-z0-9_]+$/.test(parsedUrl.username)) {
    runnerError(
      "TARGET_REJECTED",
      "O usuário descartável deve usar o prefixo collab_test_.",
    );
  }

  if (!parsedUrl.password || !parsedUrl.port) {
    runnerError(
      "TARGET_REJECTED",
      "Credencial temporária e porta explícita são obrigatórias.",
    );
  }

  return parsedUrl;
}

async function assertDatabaseIdentity(
  transaction: TransactionSql,
  parsedUrl: URL,
): Promise<DatabaseIdentity> {
  const rows = await transaction<DatabaseIdentity[]>`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port,
      shobj_description(pg_database.oid, 'pg_database') AS database_marker,
      current_setting('server_version') AS server_version,
      current_setting('server_version_num')::integer AS server_version_number
    FROM pg_database
    WHERE datname = current_database()
  `;
  const identity = rows[0];

  if (!identity) {
    runnerError(
      "TARGET_REJECTED",
      "Não foi possível identificar o banco alvo.",
    );
  }

  if (
    identity.database_name !== databaseNameFromUrl(parsedUrl) ||
    identity.database_user !== decodeURIComponent(parsedUrl.username) ||
    identity.database_marker !== DATABASE_MARKER ||
    !isPrivateOrLoopbackAddress(identity.server_address) ||
    identity.server_version_number < 140000
  ) {
    runnerError(
      "TARGET_REJECTED",
      "A identidade real do banco não corresponde ao PostgreSQL descartável autorizado.",
    );
  }

  return identity;
}

async function applyMigrations(
  transaction: TransactionSql,
  migrations: VerifiedMigration[],
  options: MigrationRunnerOptions,
): Promise<MigrationRunReport> {
  const parsedUrl = assertIsolatedTestTarget(
    options.environment,
    options.target,
    options.databaseUrl,
  );
  const identity = await assertDatabaseIdentity(transaction, parsedUrl);
  const report = await executeVerifiedMigrations(transaction, migrations, {
    onLockAcquired: options.onLockAcquired,
    raise: runnerError,
  });

  return {
    ...report,
    serverVersion: identity.server_version,
  };
}

export async function runMigrations(
  options: MigrationRunnerOptions,
): Promise<MigrationRunReport> {
  const parsedUrl = assertIsolatedTestTarget(
    options.environment,
    options.target,
    options.databaseUrl,
  );
  const migrationsDirectory =
    options.migrationsDirectory ?? path.resolve(process.cwd(), "drizzle");
  let migrations: VerifiedMigration[];

  try {
    migrations = (await loadVerifiedMigrations(
      migrationsDirectory,
    )) as VerifiedMigration[];
  } catch (error) {
    runnerError(
      "MANIFEST_INVALID",
      "Manifesto ou migration inválida; nenhuma conexão foi aberta.",
      error,
    );
  }

  const client = postgres(parsedUrl.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => undefined,
  });

  try {
    return await client.begin((transaction) =>
      applyMigrations(transaction, migrations, options),
    );
  } catch (error) {
    if (error instanceof MigrationRunnerError) {
      throw error;
    }

    runnerError(
      "RUNNER_FAILED",
      "O runner falhou com segurança e não registrou migration incompleta.",
      error,
    );
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

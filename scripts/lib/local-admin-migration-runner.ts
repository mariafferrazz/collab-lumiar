import path from "node:path";

import postgres, { type Sql, type TransactionSql } from "postgres";
import {
  assertLocalAdminEnvironment,
  LOCAL_ADMIN_DATABASE_MARKER,
  type LocalAdminEnvironmentError,
} from "./local-admin-environment";
import { executeVerifiedMigrations } from "./migration-executor";
import { loadVerifiedMigrations } from "./migration-manifest.mjs";

interface LocalDatabaseIdentity {
  database_name: string;
  database_user: string;
  database_marker: string | null;
  server_address: string | null;
  server_version: string;
  server_version_number: number;
}

export interface LocalAdminMigrationReport {
  applied: string[];
  skipped: string[];
  serverVersion: string;
}

export class LocalAdminMigrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LocalAdminMigrationError";
  }
}

function fail(code: string, message: string, cause?: unknown): never {
  throw new LocalAdminMigrationError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isPrivateContainerAddress(address: string | null): boolean {
  if (!address) return false;
  if (address === "::1" || address.startsWith("127.")) return true;
  if (address.startsWith("10.") || address.startsWith("192.168.")) return true;
  const match = /^172\.(\d{1,2})\./u.exec(address);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export async function assertLocalAdminDatabaseIdentity(
  sql: Sql | TransactionSql,
  databaseUrl: URL,
): Promise<LocalDatabaseIdentity> {
  const rows = await sql<LocalDatabaseIdentity[]>`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      shobj_description(pg_database.oid, 'pg_database') AS database_marker,
      inet_server_addr()::text AS server_address,
      current_setting('server_version') AS server_version,
      current_setting('server_version_num')::integer AS server_version_number
    FROM pg_database
    WHERE datname = current_database()
  `;
  const identity = rows[0];

  if (
    !identity ||
    identity.database_name !==
      decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, "")) ||
    identity.database_user !== decodeURIComponent(databaseUrl.username) ||
    identity.database_marker !== LOCAL_ADMIN_DATABASE_MARKER ||
    !isPrivateContainerAddress(identity.server_address) ||
    identity.server_version_number < 180000 ||
    identity.server_version_number >= 190000
  ) {
    return fail(
      "TARGET_REJECTED",
      "A identidade real não corresponde ao PostgreSQL 18 local da COLLAB.",
    );
  }

  return identity;
}

export async function runLocalAdminMigrations(
  environment: Record<string, string | undefined>,
): Promise<LocalAdminMigrationReport> {
  let databaseUrl: URL;
  try {
    databaseUrl = assertLocalAdminEnvironment(environment);
  } catch (error) {
    return fail(
      "TARGET_REJECTED",
      "O alvo local de migrations foi rejeitado.",
      error as LocalAdminEnvironmentError,
    );
  }

  let migrations: Awaited<ReturnType<typeof loadVerifiedMigrations>>;
  try {
    migrations = await loadVerifiedMigrations(
      path.resolve(process.cwd(), "drizzle"),
    );
  } catch (error) {
    return fail(
      "MANIFEST_INVALID",
      "Manifesto ou migration inválida; nenhuma conexão foi aberta.",
      error,
    );
  }

  const client = postgres(databaseUrl.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => undefined,
  });

  try {
    return await client.begin(async (transaction) => {
      const identity = await assertLocalAdminDatabaseIdentity(
        transaction,
        databaseUrl,
      );
      const report = await executeVerifiedMigrations(transaction, migrations, {
        raise: fail,
      });

      return {
        applied: report.applied,
        skipped: report.skipped,
        serverVersion: identity.server_version,
      };
    });
  } catch (error) {
    if (error instanceof LocalAdminMigrationError) throw error;
    return fail(
      "RUNNER_FAILED",
      "A migration local falhou com segurança e foi revertida.",
      error,
    );
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

import path from "node:path";

import postgres, { type TransactionSql } from "postgres";

import {
  assertDevelopmentApproval,
  assertDevelopmentTarget,
  DEVELOPMENT_POSTGRES_MAJOR,
  DevelopmentMigrationGuardError,
  developmentDatabaseFingerprint,
  migrationManifestSha256,
  verifyBackupEvidence,
} from "./development-migration-guard";
import {
  executeVerifiedMigrations,
  type MigrationExecutionReport,
  type VerifiedMigration,
} from "./migration-executor";
import { loadVerifiedMigrations } from "./migration-manifest.mjs";

interface DevelopmentDatabaseIdentity {
  database_name: string;
  database_user: string;
  server_version: string;
  server_version_number: number;
  system_identifier: string;
}

export interface DevelopmentMigrationRunnerOptions {
  databaseUrl: string | undefined;
  project: string | undefined;
  environment: string | undefined;
  target: string | undefined;
  expectedFingerprint: string | undefined;
  backupEvidencePath: string | undefined;
  approval: string | undefined;
  projectRoot?: string;
  migrationsDirectory?: string;
  onLockAcquired?: (context: { backendPid: number }) => Promise<void> | void;
}

export interface DevelopmentMigrationRunReport
  extends MigrationExecutionReport {
  serverVersion: string;
}

export class DevelopmentMigrationRunnerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DevelopmentMigrationRunnerError";
  }
}

function runnerError(code: string, message: string, cause?: unknown): never {
  throw new DevelopmentMigrationRunnerError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

async function assertDevelopmentDatabaseIdentity(
  transaction: TransactionSql,
  parsedUrl: URL,
  expectedFingerprint: string,
): Promise<DevelopmentDatabaseIdentity> {
  const rows = await transaction<DevelopmentDatabaseIdentity[]>`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      current_setting('server_version') AS server_version,
      current_setting('server_version_num')::integer AS server_version_number,
      pg_control_system.system_identifier::text AS system_identifier
    FROM pg_control_system()
  `;
  const identity = rows[0];

  if (!identity) {
    runnerError(
      "TARGET_REJECTED",
      "Não foi possível identificar o PostgreSQL development.",
    );
  }

  const observedMajor = Math.trunc(identity.server_version_number / 10000);

  if (
    identity.database_name !==
      decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, "")) ||
    identity.database_user !== decodeURIComponent(parsedUrl.username) ||
    observedMajor !== DEVELOPMENT_POSTGRES_MAJOR ||
    developmentDatabaseFingerprint({
      systemIdentifier: identity.system_identifier,
      databaseName: identity.database_name,
      databaseUser: identity.database_user,
      serverVersionNumber: identity.server_version_number,
    }) !== expectedFingerprint
  ) {
    runnerError(
      "TARGET_REJECTED",
      "A identidade real do banco não corresponde ao development autorizado.",
    );
  }

  return identity;
}

export async function runDevelopmentMigrations(
  options: DevelopmentMigrationRunnerOptions,
): Promise<DevelopmentMigrationRunReport> {
  const parsedUrl = assertDevelopmentTarget({
    databaseUrl: options.databaseUrl,
    project: options.project,
    environment: options.environment,
    target: options.target,
  });
  const projectRoot = options.projectRoot ?? process.cwd();
  const migrationsDirectory =
    options.migrationsDirectory ?? path.resolve(projectRoot, "drizzle");
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

  const manifestSha256 = migrationManifestSha256(migrations);
  assertDevelopmentApproval(options.approval, manifestSha256);

  if (!options.expectedFingerprint) {
    runnerError(
      "TARGET_REJECTED",
      "Fingerprint do banco development não foi informado.",
    );
  }

  await verifyBackupEvidence({
    evidencePath: options.backupEvidencePath,
    projectRoot,
    expectedFingerprint: options.expectedFingerprint,
    expectedManifestSha256: manifestSha256,
  });

  const client = postgres(parsedUrl.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => undefined,
  });

  try {
    return await client.begin(async (transaction) => {
      const identity = await assertDevelopmentDatabaseIdentity(
        transaction,
        parsedUrl,
        options.expectedFingerprint as string,
      );
      const report = await executeVerifiedMigrations(transaction, migrations, {
        onLockAcquired: options.onLockAcquired,
        raise: runnerError,
      });

      return { ...report, serverVersion: identity.server_version };
    });
  } catch (error) {
    if (
      error instanceof DevelopmentMigrationRunnerError ||
      error instanceof DevelopmentMigrationGuardError
    ) {
      throw error;
    }

    runnerError(
      "RUNNER_FAILED",
      "O runner development falhou com segurança e reverteu a transação.",
      error,
    );
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

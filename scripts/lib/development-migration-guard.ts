import { createHash } from "node:crypto";
import { createReadStream, type Stats } from "node:fs";
import { open, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { VerifiedMigration } from "./migration-executor";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CUSTOM_DUMP_MAGIC = Buffer.from("PGDMP", "ascii");
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;

export const DEVELOPMENT_PROJECT = "collab";
export const DEVELOPMENT_ENVIRONMENT = "development";
export const DEVELOPMENT_TARGET = "railway-development";
export const DEVELOPMENT_POSTGRES_MAJOR = 18;

export interface DevelopmentTargetOptions {
  databaseUrl: string | undefined;
  project: string | undefined;
  environment: string | undefined;
  target: string | undefined;
}

export interface DevelopmentDatabaseFingerprintInput {
  systemIdentifier: string;
  databaseName: string;
  databaseUser: string;
  serverVersionNumber: number;
}

export interface BackupEvidence {
  formatVersion: 1;
  project: typeof DEVELOPMENT_PROJECT;
  environment: typeof DEVELOPMENT_ENVIRONMENT;
  sourceFingerprintSha256: string;
  postgresMajor: number;
  backupPath: string;
  backupSha256: string;
  backupSizeBytes: number;
  pgRestoreListSha256: string;
  sourceCatalogSha256: string;
  restoredCatalogSha256: string;
  sourceObjectCount: number;
  restoredObjectCount: number;
  migrationManifestSha256: string;
  createdAt: string;
  verifiedAt: string;
  restoreVerifiedAt: string;
}

export class DevelopmentMigrationGuardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DevelopmentMigrationGuardError";
  }
}

function guardError(code: string, message: string, cause?: unknown): never {
  throw new DevelopmentMigrationGuardError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function databaseNameFromUrl(url: URL): string {
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  if (!databaseName || databaseName.includes("/")) {
    guardError("TARGET_REJECTED", "Nome do banco development inválido.");
  }

  return databaseName;
}

function isPathWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function assertBackupStorageLocation(
  candidate: string,
  projectRoot: string,
): string {
  if (!path.isAbsolute(candidate)) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Backup e evidência devem usar caminhos absolutos.",
    );
  }

  const resolved = path.resolve(candidate);

  if (
    isPathWithin(resolved, path.resolve(projectRoot)) ||
    /(^|[\\/])OneDrive([\\/]|$)/iu.test(resolved)
  ) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Backup e evidência devem ficar fora do Git e do OneDrive.",
    );
  }

  return resolved;
}

export function assertDevelopmentTarget(
  options: DevelopmentTargetOptions,
): URL {
  if (
    options.project !== DEVELOPMENT_PROJECT ||
    options.environment !== DEVELOPMENT_ENVIRONMENT ||
    options.target !== DEVELOPMENT_TARGET
  ) {
    guardError(
      "TARGET_REJECTED",
      "O runner exige projeto collab, ambiente development e alvo railway-development.",
    );
  }

  if (!options.databaseUrl) {
    guardError("TARGET_REJECTED", "URL exclusiva de development ausente.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(options.databaseUrl);
  } catch {
    guardError("TARGET_REJECTED", "URL exclusiva de development inválida.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsedUrl.protocol)) {
    guardError("TARGET_REJECTED", "O destino deve utilizar PostgreSQL.");
  }

  if (!LOOPBACK_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    guardError(
      "TARGET_REJECTED",
      "O runner development aceita somente o túnel em loopback.",
    );
  }

  databaseNameFromUrl(parsedUrl);

  if (!parsedUrl.port || !parsedUrl.username || !parsedUrl.password) {
    guardError(
      "TARGET_REJECTED",
      "Porta explícita e credenciais do túnel são obrigatórias.",
    );
  }

  return parsedUrl;
}

export function migrationManifestSha256(
  migrations: Pick<VerifiedMigration, "id" | "sha256">[],
): string {
  const canonical = migrations
    .map((migration) => `${migration.id}:${migration.sha256}`)
    .join("\n");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function developmentDatabaseFingerprint(
  identity: DevelopmentDatabaseFingerprintInput,
): string {
  const canonicalIdentity = [
    identity.systemIdentifier,
    identity.databaseName,
    identity.databaseUser,
    String(identity.serverVersionNumber),
  ].join("\n");

  return createHash("sha256").update(canonicalIdentity, "utf8").digest("hex");
}

export function requiredDevelopmentApproval(manifestSha256: string): string {
  if (!SHA256_PATTERN.test(manifestSha256)) {
    guardError("AUTHORIZATION_REJECTED", "Checksum do manifesto inválido.");
  }

  return `APPLY_COLLAB_DEVELOPMENT:${manifestSha256}`;
}

export function assertDevelopmentApproval(
  suppliedApproval: string | undefined,
  manifestSha256: string,
): void {
  if (suppliedApproval !== requiredDevelopmentApproval(manifestSha256)) {
    guardError(
      "AUTHORIZATION_REJECTED",
      "Autorização explícita ausente ou não corresponde ao manifesto atual.",
    );
  }
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function parseTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      `Data inválida na evidência de backup: ${label}.`,
    );
  }

  return timestamp;
}

export async function verifyBackupEvidence(options: {
  evidencePath: string | undefined;
  projectRoot: string;
  expectedFingerprint: string;
  expectedManifestSha256: string;
  expectedPostgresMajor?: number;
  now?: Date;
}): Promise<BackupEvidence> {
  if (!options.evidencePath) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Evidência de backup e restauração ausente.",
    );
  }

  if (!SHA256_PATTERN.test(options.expectedFingerprint)) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Fingerprint esperado do banco development é inválido.",
    );
  }

  const evidenceLocation = assertBackupStorageLocation(
    options.evidencePath,
    options.projectRoot,
  );
  let evidence: BackupEvidence;

  try {
    const canonicalEvidencePath = await realpath(evidenceLocation);
    assertBackupStorageLocation(canonicalEvidencePath, options.projectRoot);
    evidence = JSON.parse(
      await readFile(canonicalEvidencePath, "utf8"),
    ) as BackupEvidence;
  } catch (error) {
    if (error instanceof DevelopmentMigrationGuardError) {
      throw error;
    }

    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Evidência de backup ausente ou inválida.",
      error,
    );
  }

  const expectedMajor =
    options.expectedPostgresMajor ?? DEVELOPMENT_POSTGRES_MAJOR;
  const digestFields = [
    evidence.backupSha256,
    evidence.pgRestoreListSha256,
    evidence.sourceCatalogSha256,
    evidence.restoredCatalogSha256,
    evidence.migrationManifestSha256,
    evidence.sourceFingerprintSha256,
  ];

  if (
    evidence.formatVersion !== 1 ||
    evidence.project !== DEVELOPMENT_PROJECT ||
    evidence.environment !== DEVELOPMENT_ENVIRONMENT ||
    evidence.postgresMajor !== expectedMajor ||
    digestFields.some((digest) => !SHA256_PATTERN.test(digest)) ||
    evidence.sourceFingerprintSha256 !== options.expectedFingerprint ||
    evidence.migrationManifestSha256 !== options.expectedManifestSha256 ||
    evidence.sourceCatalogSha256 !== evidence.restoredCatalogSha256 ||
    !Number.isSafeInteger(evidence.sourceObjectCount) ||
    evidence.sourceObjectCount < 0 ||
    evidence.sourceObjectCount !== evidence.restoredObjectCount ||
    !Number.isSafeInteger(evidence.backupSizeBytes) ||
    evidence.backupSizeBytes <= CUSTOM_DUMP_MAGIC.length
  ) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Evidência não corresponde ao projeto, banco, manifesto ou restauração exigidos.",
    );
  }

  const createdAt = parseTimestamp(evidence.createdAt, "createdAt");
  const verifiedAt = parseTimestamp(evidence.verifiedAt, "verifiedAt");
  const restoreVerifiedAt = parseTimestamp(
    evidence.restoreVerifiedAt,
    "restoreVerifiedAt",
  );
  const now = (options.now ?? new Date()).getTime();

  if (
    createdAt > verifiedAt ||
    verifiedAt > restoreVerifiedAt ||
    restoreVerifiedAt > now + 5 * 60 * 1000 ||
    now - createdAt > MAX_BACKUP_AGE_MS
  ) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Backup expirado ou sequência temporal de verificação inválida.",
    );
  }

  const backupLocation = assertBackupStorageLocation(
    evidence.backupPath,
    options.projectRoot,
  );
  let canonicalBackupPath: string;
  let backupStats: Stats;
  let magic: Buffer;

  try {
    canonicalBackupPath = await realpath(backupLocation);
    assertBackupStorageLocation(canonicalBackupPath, options.projectRoot);
    backupStats = await stat(canonicalBackupPath);
    const handle = await open(canonicalBackupPath, "r");

    try {
      magic = Buffer.alloc(CUSTOM_DUMP_MAGIC.length);
      await handle.read(magic, 0, magic.length, 0);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof DevelopmentMigrationGuardError) {
      throw error;
    }

    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Arquivo de backup ausente ou inacessível.",
      error,
    );
  }

  if (
    !backupStats.isFile() ||
    backupStats.size !== evidence.backupSizeBytes ||
    !magic.equals(CUSTOM_DUMP_MAGIC) ||
    (await sha256File(canonicalBackupPath)) !== evidence.backupSha256
  ) {
    guardError(
      "BACKUP_EVIDENCE_REJECTED",
      "Integridade ou formato custom do backup não foi confirmado.",
    );
  }

  return evidence;
}

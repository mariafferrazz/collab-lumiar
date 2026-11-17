import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertBackupStorageLocation,
  assertDevelopmentApproval,
  assertDevelopmentTarget,
  DEVELOPMENT_ENVIRONMENT,
  DEVELOPMENT_POSTGRES_MAJOR,
  DEVELOPMENT_PROJECT,
  DEVELOPMENT_TARGET,
  DevelopmentMigrationGuardError,
  developmentDatabaseFingerprint,
  migrationManifestSha256,
  requiredDevelopmentApproval,
  verifyBackupEvidence,
} from "../scripts/lib/development-migration-guard";

const safeDevelopmentUrl =
  "postgresql://development_user:temporary@127.0.0.1:55432/collab";
const fingerprint = "a".repeat(64);

function expectGuardCode(operation: () => unknown, expectedCode: string) {
  assert.throws(
    operation,
    (error) =>
      error instanceof DevelopmentMigrationGuardError &&
      error.code === expectedCode,
  );
}

test("development exige projeto, ambiente, alvo e túnel explícitos", () => {
  const parsed = assertDevelopmentTarget({
    databaseUrl: safeDevelopmentUrl,
    project: DEVELOPMENT_PROJECT,
    environment: DEVELOPMENT_ENVIRONMENT,
    target: DEVELOPMENT_TARGET,
  });

  assert.equal(parsed.hostname, "127.0.0.1");

  for (const rejected of [
    {
      databaseUrl: safeDevelopmentUrl,
      project: DEVELOPMENT_PROJECT,
      environment: "production",
      target: DEVELOPMENT_TARGET,
    },
    {
      databaseUrl: safeDevelopmentUrl,
      project: "outro-projeto",
      environment: DEVELOPMENT_ENVIRONMENT,
      target: DEVELOPMENT_TARGET,
    },
    {
      databaseUrl:
        "postgresql://development_user:temporary@remote.example.invalid:5432/collab",
      project: DEVELOPMENT_PROJECT,
      environment: DEVELOPMENT_ENVIRONMENT,
      target: DEVELOPMENT_TARGET,
    },
  ]) {
    expectGuardCode(() => assertDevelopmentTarget(rejected), "TARGET_REJECTED");
  }
});

test("autorização é vinculada ao conjunto imutável de migrations", () => {
  const manifestSha256 = migrationManifestSha256([
    { id: "0000_collab_catalog", sha256: "b".repeat(64) },
  ]);
  const approval = requiredDevelopmentApproval(manifestSha256);

  assert.doesNotThrow(() =>
    assertDevelopmentApproval(approval, manifestSha256),
  );
  expectGuardCode(
    () => assertDevelopmentApproval("APPLY_COLLAB_DEVELOPMENT", manifestSha256),
    "AUTHORIZATION_REJECTED",
  );
});

test("fingerprint vincula instância, banco, usuário e versão", () => {
  const baseIdentity = {
    systemIdentifier: "7560000000000000000",
    databaseName: "collab",
    databaseUser: "development_user",
    serverVersionNumber: 180006,
  };
  const fingerprintA = developmentDatabaseFingerprint(baseIdentity);
  const fingerprintB = developmentDatabaseFingerprint({
    ...baseIdentity,
    databaseName: "outro_banco",
  });

  assert.match(fingerprintA, /^[a-f0-9]{64}$/);
  assert.notEqual(fingerprintA, fingerprintB);
});

test("backup e evidência são rejeitados dentro do projeto ou do OneDrive", () => {
  expectGuardCode(
    () =>
      assertBackupStorageLocation(
        path.join(process.cwd(), "backups", "development.backup"),
        process.cwd(),
      ),
    "BACKUP_EVIDENCE_REJECTED",
  );
  expectGuardCode(
    () =>
      assertBackupStorageLocation(
        "C:\\Users\\operator\\OneDrive\\development.backup",
        "C:\\workspace\\collab",
      ),
    "BACKUP_EVIDENCE_REJECTED",
  );
});

test("evidência válida liga backup, restauração, banco e manifesto", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "collab-backup-evidence-"),
  );
  const backupPath = path.join(directory, "development.backup");
  const evidencePath = path.join(directory, "evidence.json");
  const backupContents = Buffer.concat([
    Buffer.from("PGDMP", "ascii"),
    Buffer.from("unit-test-contents", "utf8"),
  ]);
  const backupSha256 = createHash("sha256")
    .update(backupContents)
    .digest("hex");
  const manifestSha256 = migrationManifestSha256([
    { id: "0000_collab_catalog", sha256: "b".repeat(64) },
  ]);
  const catalogSha256 = "c".repeat(64);

  try {
    await writeFile(backupPath, backupContents);
    const backupStats = await stat(backupPath);
    await writeFile(
      evidencePath,
      JSON.stringify({
        formatVersion: 1,
        project: DEVELOPMENT_PROJECT,
        environment: DEVELOPMENT_ENVIRONMENT,
        sourceFingerprintSha256: fingerprint,
        postgresMajor: DEVELOPMENT_POSTGRES_MAJOR,
        backupPath,
        backupSha256,
        backupSizeBytes: backupStats.size,
        pgRestoreListSha256: "d".repeat(64),
        sourceCatalogSha256: catalogSha256,
        restoredCatalogSha256: catalogSha256,
        sourceObjectCount: 0,
        restoredObjectCount: 0,
        migrationManifestSha256: manifestSha256,
        createdAt: "2026-11-17T12:00:00.000Z",
        verifiedAt: "2026-11-17T12:01:00.000Z",
        restoreVerifiedAt: "2026-11-17T12:02:00.000Z",
      }),
      "utf8",
    );

    const evidence = await verifyBackupEvidence({
      evidencePath,
      projectRoot: process.cwd(),
      expectedFingerprint: fingerprint,
      expectedManifestSha256: manifestSha256,
      now: new Date("2026-11-17T12:03:00.000Z"),
    });

    assert.equal(evidence.backupSha256, backupSha256);

    await writeFile(backupPath, Buffer.from("PGDMPtampered", "utf8"));
    await assert.rejects(
      verifyBackupEvidence({
        evidencePath,
        projectRoot: process.cwd(),
        expectedFingerprint: fingerprint,
        expectedManifestSha256: manifestSha256,
        now: new Date("2026-11-17T12:03:00.000Z"),
      }),
      (error) =>
        error instanceof DevelopmentMigrationGuardError &&
        error.code === "BACKUP_EVIDENCE_REJECTED",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

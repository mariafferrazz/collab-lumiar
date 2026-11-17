import assert from "node:assert/strict";
import test from "node:test";

import { assertMigrationIsTransactional } from "../scripts/lib/migration-manifest.mjs";
import {
  assertIsolatedTestTarget,
  MigrationRunnerError,
} from "../scripts/lib/migration-runner";

const safeTestUrl =
  "postgresql://collab_test_runner:temporary@127.0.0.1:55432/collab_test_catalog";

test("aceita somente configuração explícita do PostgreSQL descartável", () => {
  const parsedUrl = assertIsolatedTestTarget(
    "test",
    "isolated-postgres",
    safeTestUrl,
  );

  assert.equal(parsedUrl.hostname, "127.0.0.1");
  assert.equal(parsedUrl.pathname, "/collab_test_catalog");
});

test("bloqueia development, production e endpoints remotos", () => {
  for (const [environment, target, databaseUrl] of [
    ["development", "isolated-postgres", safeTestUrl],
    ["production", "isolated-postgres", safeTestUrl],
    ["test", "railway-development", safeTestUrl],
    [
      "test",
      "isolated-postgres",
      "postgresql://collab_test_runner:temporary@db.example.invalid:5432/collab_test_catalog",
    ],
    [
      "test",
      "isolated-postgres",
      "postgresql://collab_test_runner:temporary@127.0.0.1:55432/collab",
    ],
  ] as const) {
    assert.throws(
      () => assertIsolatedTestTarget(environment, target, databaseUrl),
      (error) =>
        error instanceof MigrationRunnerError &&
        error.code === "TARGET_REJECTED",
    );
  }
});

test("aceita o SQL atual como transacional e rejeita operações incompatíveis", () => {
  assert.doesNotThrow(() =>
    assertMigrationIsTransactional(
      "0000_safe",
      "CREATE TABLE safe_example (id integer);",
    ),
  );
  assert.throws(() =>
    assertMigrationIsTransactional(
      "0001_unsafe",
      "CREATE INDEX CONCURRENTLY unsafe_idx ON safe_example (id);",
    ),
  );
  assert.throws(() =>
    assertMigrationIsTransactional("0002_nested", "BEGIN; SELECT 1; COMMIT;"),
  );
});

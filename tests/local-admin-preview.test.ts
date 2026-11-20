import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertLocalAdminEnvironment,
  buildLocalAdminProcessEnvironment,
  LOCAL_ADMIN_AUTH_URL,
  LOCAL_ADMIN_CATALOG_SOURCE,
  LOCAL_ADMIN_DATABASE_NAME,
  LOCAL_ADMIN_DATABASE_PORT,
  LOCAL_ADMIN_DATABASE_USER,
  LOCAL_ADMIN_ENVIRONMENT,
  LOCAL_ADMIN_MIGRATION_TARGET,
} from "../scripts/lib/local-admin-environment";

const safeConfiguration = {
  COLLAB_LOCAL_DB_PASSWORD: "local-test-placeholder-not-a-secret",
  DATABASE_ENVIRONMENT: LOCAL_ADMIN_ENVIRONMENT,
  MIGRATION_TARGET: LOCAL_ADMIN_MIGRATION_TARGET,
  DATABASE_URL:
    `postgresql://${LOCAL_ADMIN_DATABASE_USER}:local-test-placeholder-not-a-secret` +
    `@127.0.0.1:${LOCAL_ADMIN_DATABASE_PORT}/${LOCAL_ADMIN_DATABASE_NAME}`,
  BETTER_AUTH_SECRET: "local-test-placeholder-not-a-secret-32-characters",
  BETTER_AUTH_URL: LOCAL_ADMIN_AUTH_URL,
  AUTH_PUBLIC_SIGNUP_ENABLED: "false",
  AUTH_EMAIL_PROVIDER: "disabled",
};

test("aceita somente o banco persistente de administração em loopback", () => {
  const target = assertLocalAdminEnvironment(safeConfiguration);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55432");
  assert.equal(target.pathname, "/collab_local_admin");
});

test("inicialização local seleciona o catálogo persistido sem herdar Railway", () => {
  const environment = buildLocalAdminProcessEnvironment(safeConfiguration, {
    NODE_ENV: "test",
    CATALOG_DATA_SOURCE: "demo",
    COLLAB_DEVELOPMENT_DATABASE_URL: "sensitive-placeholder",
    RAILWAY_PROJECT_NAME: "unexpected",
  });
  assert.equal(environment.CATALOG_DATA_SOURCE, LOCAL_ADMIN_CATALOG_SOURCE);
  assert.equal(environment.COLLAB_DEVELOPMENT_DATABASE_URL, "");
  assert.equal(environment.RAILWAY_PROJECT_NAME, "");
});

test("rejeita Railway, porta diferente e cadastro público local", () => {
  assert.throws(() =>
    assertLocalAdminEnvironment({
      ...safeConfiguration,
      DATABASE_URL:
        "postgresql://collab_local_admin:password@postgres.railway.internal:5432/collab_local_admin",
    }),
  );
  assert.throws(() =>
    assertLocalAdminEnvironment({
      ...safeConfiguration,
      DATABASE_URL:
        "postgresql://collab_local_admin:password@127.0.0.1:15432/collab_local_admin",
    }),
  );
  assert.throws(() =>
    assertLocalAdminEnvironment({
      ...safeConfiguration,
      AUTH_PUBLIC_SIGNUP_ENABLED: "true",
    }),
  );
});

test("Compose local usa volume persistente e publica somente em loopback", async () => {
  const compose = await readFile(
    path.join(process.cwd(), "compose.postgres-local-admin.yml"),
    "utf8",
  );
  assert.match(compose, /127\.0\.0\.1:55432:5432/u);
  assert.match(compose, /collab-local-admin-data:\/var\/lib\/postgresql/u);
  assert.match(
    compose,
    /COLLAB_LOCAL_DB_VOLUME_NAME:-collab-local-admin-reconciled-data/u,
  );
  assert.match(compose, /com\.collab\.environment: local-development/u);
  assert.doesNotMatch(compose, /tmpfs/u);
  assert.doesNotMatch(compose, /railway/iu);
});

test("provisionamento local não cria rota web nem credencial fixa", async () => {
  const provisioner = await readFile(
    path.join(process.cwd(), "scripts", "provision-local-admin.ts"),
    "utf8",
  );
  assert.match(provisioner, /auth\.api\.createUser/u);
  assert.match(provisioner, /publicSignupEnabled: false/u);
  assert.match(provisioner, /readHidden/u);
  assert.doesNotMatch(provisioner, /INSERT INTO "user"/u);
  assert.doesNotMatch(provisioner, /UPDATE "user"/u);

  const apiFiles = await readFile(
    path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "auth",
      "[...all]",
      "route.ts",
    ),
    "utf8",
  );
  assert.doesNotMatch(apiFiles, /createUser|create-admin|provision/iu);
});

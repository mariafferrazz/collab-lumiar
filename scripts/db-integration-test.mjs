import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";

import {
  resolveDockerExecutable,
  withDockerBinaryPath,
} from "./lib/docker-executable.mjs";
import {
  parsePublishedPostgresEndpoint,
  waitForPostgresSql,
  waitForPublishedTcp,
} from "./lib/postgres-readiness.mjs";

const composeFile = path.resolve(process.cwd(), "compose.postgres-test.yml");
const projectName = `collab-pg-test-${randomBytes(6).toString("hex")}`;

const dockerExecutable = resolveDockerExecutable();

function dockerCompose(arguments_, environment, stdio = "inherit") {
  return spawnSync(
    dockerExecutable,
    ["compose", "-f", composeFile, "-p", projectName, ...arguments_],
    {
      cwd: process.cwd(),
      env: withDockerBinaryPath(environment, dockerExecutable),
      stdio,
      encoding: stdio === "pipe" ? "utf8" : undefined,
    },
  );
}

function assertDockerAvailable() {
  const docker = spawnSync(dockerExecutable, ["--version"], {
    encoding: "utf8",
    env: withDockerBinaryPath(process.env, dockerExecutable),
    stdio: "pipe",
  });
  const compose = spawnSync(dockerExecutable, ["compose", "version"], {
    encoding: "utf8",
    env: withDockerBinaryPath(process.env, dockerExecutable),
    stdio: "pipe",
  });

  if (docker.status !== 0 || compose.status !== 0) {
    throw new Error(
      "Docker e Docker Compose são obrigatórios para o PostgreSQL descartável.",
    );
  }
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Não foi possível selecionar uma porta local."));
        return;
      }

      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function discoverPublishedEndpoint(environment) {
  const retryDelaysMs = [0, 100, 200, 400, 800, 1200];

  for (const [index, retryDelay] of retryDelaysMs.entries()) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    const result = dockerCompose(
      ["port", "--index", "1", "postgres-test", "5432"],
      environment,
      "pipe",
    );

    if (result.status === 0 && result.stdout) {
      try {
        return parsePublishedPostgresEndpoint(result.stdout);
      } catch {
        // O proxy do Docker Desktop pode ainda não ter publicado a porta.
      }
    }

    if (index === retryDelaysMs.length - 1) {
      throw new Error(
        "O Docker não disponibilizou um mapeamento local para o PostgreSQL.",
      );
    }
  }

  throw new Error("A descoberta da porta PostgreSQL não foi concluída.");
}

function runIntegrationTests(environment) {
  const tsxCli = path.resolve(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [tsxCli, "--test", "tests/integration/postgres-migrations.test.ts"],
      {
        cwd: process.cwd(),
        env: environment,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error("Testes de integração foram interrompidos."));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function main() {
  assertDockerAvailable();

  const requestedPort = await findAvailablePort();
  const password = randomBytes(32).toString("base64url");
  const environment = {
    ...process.env,
    COLLAB_TEST_DB_PASSWORD: password,
    COLLAB_TEST_DB_PORT: String(requestedPort),
    DATABASE_ENVIRONMENT: "test",
    MIGRATION_TARGET: "isolated-postgres",
  };

  try {
    const start = dockerCompose(
      ["up", "--detach", "--wait", "--wait-timeout", "60"],
      environment,
    );

    if (start.status !== 0) {
      throw new Error("O PostgreSQL descartável não ficou saudável.");
    }

    console.log(
      "[db:integration] Healthcheck interno aprovado; verificando a publicação no Windows.",
    );
    const endpoint = await discoverPublishedEndpoint(environment);
    const databaseUrlHost = endpoint.host.includes(":")
      ? `[${endpoint.host}]`
      : endpoint.host;
    const databaseUrl =
      `postgresql://collab_test_runner:${encodeURIComponent(password)}` +
      `@${databaseUrlHost}:${endpoint.port}/collab_test_catalog`;
    const tcpReadiness = await waitForPublishedTcp(
      endpoint.host,
      endpoint.port,
    );
    console.log(
      `[db:integration] Porta local ${endpoint.port} aceita TCP após ${tcpReadiness.attempts} tentativa(s).`,
    );
    const sqlReadiness = await waitForPostgresSql(databaseUrl);
    console.log(
      `[db:integration] PostgreSQL isolado ${sqlReadiness.version} respondeu SQL após ${sqlReadiness.attempts} tentativa(s).`,
    );

    process.exitCode = await runIntegrationTests({
      ...environment,
      COLLAB_TEST_DATABASE_URL: databaseUrl,
    });
  } finally {
    const stop = dockerCompose(
      ["down", "--volumes", "--remove-orphans", "--timeout", "5"],
      environment,
      "pipe",
    );

    if (stop.status !== 0) {
      console.error(
        "[db:integration] Não foi possível confirmar a remoção do contêiner descartável.",
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(
    `[db:integration] ${
      error instanceof Error
        ? error.message
        : "Falha segura nos testes isolados."
    }`,
  );
  process.exitCode = 1;
});

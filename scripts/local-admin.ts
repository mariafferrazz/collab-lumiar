import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import {
  resolveDockerExecutable,
  withDockerBinaryPath,
} from "./lib/docker-executable.mjs";
import {
  buildLocalAdminProcessEnvironment,
  ensureLocalAdminEnvironment,
  readLocalAdminEnvironment,
} from "./lib/local-admin-environment";
import { warmLocalPreview } from "./lib/local-preview-warmup.mjs";
import { waitForPostgresSql } from "./lib/postgres-readiness.mjs";

const composeFile = path.resolve(
  process.cwd(),
  "compose.postgres-local-admin.yml",
);
const composeProject = "collab-local-admin";
const dockerExecutable = resolveDockerExecutable();

function fail(message: string): never {
  throw new Error(message);
}

function dockerCompose(
  environmentPath: string,
  environment: NodeJS.ProcessEnv,
  arguments_: string[],
  stdio: "inherit" | "pipe" = "inherit",
) {
  return spawnSync(
    dockerExecutable,
    [
      "compose",
      "--env-file",
      environmentPath,
      "-f",
      composeFile,
      "-p",
      composeProject,
      ...arguments_,
    ],
    {
      cwd: process.cwd(),
      env: withDockerBinaryPath(environment, dockerExecutable),
      stdio,
      encoding: stdio === "pipe" ? "utf8" : undefined,
    },
  );
}

function assertDockerAvailable(environment: NodeJS.ProcessEnv) {
  const docker = spawnSync(dockerExecutable, ["--version"], {
    encoding: "utf8",
    env: withDockerBinaryPath(environment, dockerExecutable),
    stdio: "pipe",
  });
  const compose = spawnSync(dockerExecutable, ["compose", "version"], {
    encoding: "utf8",
    env: withDockerBinaryPath(environment, dockerExecutable),
    stdio: "pipe",
  });

  if (docker.status !== 0 || compose.status !== 0) {
    fail("Abra o Docker Desktop e aguarde até ele indicar que está pronto.");
  }
}

function runTsxScript(script: string, environment: NodeJS.ProcessEnv) {
  const tsxCli = path.resolve(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const result = spawnSync(process.execPath, [tsxCli, script], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    fail("A preparação local foi interrompida com segurança.");
  }
}

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `A porta ${port} já está em uso. Encerre o servidor anterior antes de continuar.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}

async function setupLocalEnvironment() {
  const configuration = await ensureLocalAdminEnvironment();
  const environment = buildLocalAdminProcessEnvironment(
    configuration.environment,
  );
  assertDockerAvailable(environment);

  const start = dockerCompose(configuration.path, environment, [
    "up",
    "--detach",
    "--wait",
    "--wait-timeout",
    "60",
  ]);
  if (start.status !== 0) {
    fail("O PostgreSQL local não ficou saudável.");
  }

  const readiness = await waitForPostgresSql(
    configuration.environment.DATABASE_URL,
  );
  runTsxScript("scripts/db-migrate-local-admin.ts", environment);
  console.log(
    `[local-admin] PostgreSQL ${readiness.version} local pronto; ` +
      `configuração ${configuration.created ? "criada" : "preservada"} fora do Git.`,
  );

  return { configuration, environment };
}

async function startApplication() {
  const { environment } = await setupLocalEnvironment();
  await assertPortAvailable(3000);
  const nextCli = path.resolve(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );

  console.log(
    "[local-admin] DESENVOLVIMENTO LOCAL: http://localhost:3000/entrar",
  );
  const child = spawn(
    process.execPath,
    [nextCli, "dev", "--hostname", "127.0.0.1", "--port", "3000"],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
    },
  );

  void warmLocalPreview()
    .then(({ routes, totalMs }) => {
      console.log(
        `[local-admin] Prévia pública aquecida em ${Math.round(totalMs)} ms: ` +
          routes.map(({ route }) => route).join(", "),
      );
    })
    .catch(() => {
      console.warn(
        "[local-admin] O pré-aquecimento não concluiu; o primeiro acesso pode compilar a página.",
      );
    });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) return resolve(0);
      return resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
}

async function stopLocalDatabase() {
  const configuration = await readLocalAdminEnvironment();
  const environment = buildLocalAdminProcessEnvironment(
    configuration.environment,
  );
  assertDockerAvailable(environment);
  const stop = dockerCompose(configuration.path, environment, [
    "down",
    "--remove-orphans",
    "--timeout",
    "5",
  ]);
  if (stop.status !== 0) fail("Não foi possível encerrar o banco local.");
  console.log(
    "[local-admin] Banco local encerrado; dados persistentes preservados.",
  );
}

async function showStatus() {
  const configuration = await readLocalAdminEnvironment();
  const environment = buildLocalAdminProcessEnvironment(
    configuration.environment,
  );
  assertDockerAvailable(environment);
  const status = dockerCompose(
    configuration.path,
    environment,
    ["ps"],
    "inherit",
  );
  if (status.status !== 0) fail("Não foi possível consultar o ambiente local.");
}

async function resetLocalDatabase() {
  const confirmation = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await confirmation.question(
    'Digite exatamente "APAGAR DADOS LOCAIS" para remover somente o banco local da COLLAB: ',
  );
  confirmation.close();
  if (answer !== "APAGAR DADOS LOCAIS") {
    console.log("[local-admin] Limpeza cancelada; nenhum dado foi removido.");
    return;
  }

  const configuration = await readLocalAdminEnvironment();
  const environment = buildLocalAdminProcessEnvironment(
    configuration.environment,
  );
  assertDockerAvailable(environment);
  const reset = dockerCompose(configuration.path, environment, [
    "down",
    "--volumes",
    "--remove-orphans",
    "--timeout",
    "5",
  ]);
  if (reset.status !== 0) fail("A limpeza local não foi concluída.");
  console.log(
    "[local-admin] Volume local removido. Nenhum banco externo foi acessado.",
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "setup") return setupLocalEnvironment();
  if (command === "start") return startApplication();
  if (command === "stop") return stopLocalDatabase();
  if (command === "status") return showStatus();
  if (command === "reset") return resetLocalDatabase();
  return fail("Comando local inválido.");
}

main().catch((error) => {
  console.error(
    `[local-admin] ${
      error instanceof Error ? error.message : "Falha segura no ambiente local."
    }`,
  );
  process.exitCode = 1;
});

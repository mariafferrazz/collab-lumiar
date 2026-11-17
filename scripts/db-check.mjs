import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const LOG_PREFIX = "[db:check]";
const LOCAL_TUNNEL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function stopWithConfigurationError(message) {
  console.error(`${LOG_PREFIX} Configuração inválida: ${message}`);
  process.exit(1);
}

function readErrorCode(error) {
  let currentError = error;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!currentError || typeof currentError !== "object") {
      return null;
    }

    if ("code" in currentError && typeof currentError.code === "string") {
      return currentError.code;
    }

    currentError = "cause" in currentError ? currentError.cause : null;
  }

  return null;
}

function describeConnectionFailure(error) {
  const code = readErrorCode(error);

  switch (code) {
    case "ECONNREFUSED":
      return "o túnel local recusou a conexão; confirme se ele continua ativo.";
    case "ECONNRESET":
      return "o túnel local encerrou a conexão; recrie-o explicitamente para o ambiente development.";
    case "ETIMEDOUT":
    case "ENETUNREACH":
      return "o PostgreSQL não respondeu pelo túnel dentro do tempo esperado.";
    case "28P01":
      return "a autenticação do PostgreSQL foi recusada.";
    case "3D000":
      return "o banco configurado não foi encontrado.";
    default:
      return "não foi possível concluir o SELECT 1 pelo túnel local.";
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  stopWithConfigurationError("DATABASE_URL está ausente em .env.local.");
}

let parsedDatabaseUrl;

try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  stopWithConfigurationError("DATABASE_URL não é uma URL válida.");
}

if (!new Set(["postgres:", "postgresql:"]).has(parsedDatabaseUrl.protocol)) {
  stopWithConfigurationError("DATABASE_URL deve usar PostgreSQL.");
}

if (!LOCAL_TUNNEL_HOSTS.has(parsedDatabaseUrl.hostname.toLowerCase())) {
  stopWithConfigurationError(
    "db:check aceita somente um endpoint de loopback criado pelo túnel de development.",
  );
}

console.log(
  `${LOG_PREFIX} Configuração válida: DATABASE_URL presente e endpoint restrito ao túnel local.`,
);

const postgresClient = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 1,
  prepare: false,
});

try {
  const database = drizzle({ client: postgresClient });
  const result = await database.execute(sql`select 1 as connection_check`);

  if (String(result[0]?.connection_check) !== "1") {
    throw new Error("unexpected-select-result");
  }

  console.log(`${LOG_PREFIX} Conexão PostgreSQL confirmada com SELECT 1.`);
} catch (error) {
  console.error(`${LOG_PREFIX} Falha: ${describeConnectionFailure(error)}`);
  process.exitCode = 1;
} finally {
  try {
    await postgresClient.end({ timeout: 5 });
    console.log(`${LOG_PREFIX} Conexão encerrada corretamente.`);
  } catch {
    console.error(
      `${LOG_PREFIX} Falha ao encerrar a conexão PostgreSQL de verificação.`,
    );
    process.exitCode = 1;
  }
}

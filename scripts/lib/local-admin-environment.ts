import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const LOCAL_ADMIN_DATABASE_NAME = "collab_local_admin";
export const LOCAL_ADMIN_DATABASE_USER = "collab_local_admin";
export const LOCAL_ADMIN_DATABASE_PORT = "55432";
export const LOCAL_ADMIN_DATABASE_MARKER = "COLLAB_LOCAL_DEVELOPMENT_DATABASE";
export const LOCAL_ADMIN_ENVIRONMENT = "local";
export const LOCAL_ADMIN_MIGRATION_TARGET = "local-admin-postgres";
export const LOCAL_ADMIN_AUTH_URL = "http://localhost:3000";
export const LOCAL_ADMIN_CATALOG_SOURCE = "persisted-local";

const PRIVATE_EXTERNAL_VARIABLES = [
  "COLLAB_DEVELOPMENT_DATABASE_URL",
  "COLLAB_DEVELOPMENT_DB_FINGERPRINT",
  "COLLAB_BACKUP_EVIDENCE_PATH",
  "COLLAB_MIGRATION_APPROVAL",
  "RAILWAY_PROJECT_NAME",
  "RAILWAY_ENVIRONMENT_NAME",
  "AUTH_EMAIL_FROM",
  "RESEND_API_KEY",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "MELHOR_ENVIO_CLIENT_ID",
  "MELHOR_ENVIO_CLIENT_SECRET",
  "MELHOR_ENVIO_ACCESS_TOKEN",
  "MELHOR_ENVIO_REFRESH_TOKEN",
  "INSTAGRAM_USER_ID",
  "INSTAGRAM_ACCESS_TOKEN",
] as const;

export class LocalAdminEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalAdminEnvironmentError";
  }
}

function fail(message: string): never {
  throw new LocalAdminEnvironmentError(message);
}

export function resolveLocalAdminEnvironmentPath(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const localAppData = environment.LOCALAPPDATA;

  if (!localAppData) {
    return fail("LOCALAPPDATA não está disponível para a configuração local.");
  }

  return path.join(localAppData, "COLLAB", "local-admin", "local.env");
}

function serializeEnvironment(environment: Record<string, string>): string {
  return `${Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

function parseEnvironment(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const sourceLine of contents.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) fail("A configuração local contém uma linha inválida.");

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) {
      fail("A configuração local contém um nome de variável inválido.");
    }
    parsed[key] = value;
  }

  return parsed;
}

function createEnvironmentValues(): Record<string, string> {
  const databasePassword = randomBytes(32).toString("base64url");
  const authSecret = randomBytes(48).toString("base64url");
  const databaseUrl =
    `postgresql://${LOCAL_ADMIN_DATABASE_USER}:` +
    `${encodeURIComponent(databasePassword)}@127.0.0.1:` +
    `${LOCAL_ADMIN_DATABASE_PORT}/${LOCAL_ADMIN_DATABASE_NAME}`;

  return {
    COLLAB_LOCAL_DB_PASSWORD: databasePassword,
    DATABASE_ENVIRONMENT: LOCAL_ADMIN_ENVIRONMENT,
    MIGRATION_TARGET: LOCAL_ADMIN_MIGRATION_TARGET,
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: authSecret,
    BETTER_AUTH_URL: LOCAL_ADMIN_AUTH_URL,
    AUTH_PUBLIC_SIGNUP_ENABLED: "false",
    AUTH_EMAIL_PROVIDER: "disabled",
    CATALOG_DATA_SOURCE: LOCAL_ADMIN_CATALOG_SOURCE,
  };
}

export async function ensureLocalAdminEnvironment(): Promise<{
  path: string;
  created: boolean;
  environment: Record<string, string>;
}> {
  const environmentPath = resolveLocalAdminEnvironmentPath();

  try {
    const environment = parseEnvironment(
      await readFile(environmentPath, "utf8"),
    );
    assertLocalAdminEnvironment(environment);
    return { path: environmentPath, created: false, environment };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }

  const environment = createEnvironmentValues();
  assertLocalAdminEnvironment(environment);
  await mkdir(path.dirname(environmentPath), { recursive: true });
  await writeFile(environmentPath, serializeEnvironment(environment), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await chmod(environmentPath, 0o600).catch(() => undefined);
  return { path: environmentPath, created: true, environment };
}

export async function readLocalAdminEnvironment(): Promise<{
  path: string;
  environment: Record<string, string>;
}> {
  const environmentPath = resolveLocalAdminEnvironmentPath();
  const environment = parseEnvironment(await readFile(environmentPath, "utf8"));
  assertLocalAdminEnvironment(environment);
  return { path: environmentPath, environment };
}

export function assertLocalAdminEnvironment(
  environment: Record<string, string | undefined>,
): URL {
  if (
    environment.DATABASE_ENVIRONMENT !== LOCAL_ADMIN_ENVIRONMENT ||
    environment.MIGRATION_TARGET !== LOCAL_ADMIN_MIGRATION_TARGET
  ) {
    return fail("O alvo precisa ser explicitamente o desenvolvimento local.");
  }

  if (!environment.DATABASE_URL) {
    return fail("DATABASE_URL local está ausente.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(environment.DATABASE_URL);
  } catch {
    return fail("DATABASE_URL local é inválida.");
  }

  if (
    !new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol) ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== LOCAL_ADMIN_DATABASE_PORT ||
    decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, "")) !==
      LOCAL_ADMIN_DATABASE_NAME ||
    decodeURIComponent(databaseUrl.username) !== LOCAL_ADMIN_DATABASE_USER ||
    !databaseUrl.password
  ) {
    return fail(
      "A conexão foi rejeitada: somente o PostgreSQL local da COLLAB é permitido.",
    );
  }

  if (
    environment.BETTER_AUTH_URL !== LOCAL_ADMIN_AUTH_URL ||
    (environment.BETTER_AUTH_SECRET?.length ?? 0) < 32 ||
    environment.AUTH_PUBLIC_SIGNUP_ENABLED !== "false" ||
    environment.AUTH_EMAIL_PROVIDER !== "disabled"
  ) {
    return fail(
      "A configuração local do Better Auth está incompleta ou insegura.",
    );
  }

  if (!environment.COLLAB_LOCAL_DB_PASSWORD) {
    return fail("A senha aleatória do PostgreSQL local está ausente.");
  }

  return databaseUrl;
}

export function buildLocalAdminProcessEnvironment(
  configuration: Record<string, string>,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  assertLocalAdminEnvironment(configuration);
  const environment: NodeJS.ProcessEnv = { ...base, ...configuration };

  environment.CATALOG_DATA_SOURCE = LOCAL_ADMIN_CATALOG_SOURCE;

  for (const variable of PRIVATE_EXTERNAL_VARIABLES) {
    environment[variable] = "";
  }

  return environment;
}

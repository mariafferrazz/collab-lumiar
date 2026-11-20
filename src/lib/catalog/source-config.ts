import type { PublicCatalogSource } from "@/types/public-catalog";

const LOCAL_DATABASE_NAME = "collab_local_admin";
const LOCAL_DATABASE_USER = "collab_local_admin";
const LOCAL_DATABASE_PORT = "55432";

export class PublicCatalogConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicCatalogConfigurationError";
  }
}

export function resolvePublicCatalogSource(
  environment: Record<string, string | undefined>,
): PublicCatalogSource {
  const source = environment.CATALOG_DATA_SOURCE?.trim() || "demo";

  if (source === "demo") return source;
  if (source !== "persisted-local") {
    throw new PublicCatalogConfigurationError(
      "CATALOG_DATA_SOURCE deve ser demo ou persisted-local.",
    );
  }

  if (
    environment.DATABASE_ENVIRONMENT !== "local" ||
    environment.MIGRATION_TARGET !== "local-admin-postgres"
  ) {
    throw new PublicCatalogConfigurationError(
      "O catálogo persistido exige o ambiente de desenvolvimento local isolado.",
    );
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(environment.DATABASE_URL ?? "");
  } catch {
    throw new PublicCatalogConfigurationError(
      "A conexão local do catálogo está ausente ou inválida.",
    );
  }

  const databaseName = decodeURIComponent(
    databaseUrl.pathname.replace(/^\/+/, ""),
  );
  if (
    !new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol) ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== LOCAL_DATABASE_PORT ||
    decodeURIComponent(databaseUrl.username) !== LOCAL_DATABASE_USER ||
    databaseName !== LOCAL_DATABASE_NAME ||
    !databaseUrl.password
  ) {
    throw new PublicCatalogConfigurationError(
      "O catálogo persistido aceita somente o PostgreSQL local da COLLAB.",
    );
  }

  return source;
}

export function isSafePublicImageReference(value: string | null): boolean {
  return Boolean(
    value &&
      /^\/images\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|jpe?g|png|webp)$/u.test(
        value,
      ) &&
      !value.includes(".."),
  );
}

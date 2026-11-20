import "server-only";

export const PRIVATE_ENVIRONMENT_VARIABLES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "AUTH_EMAIL_PROVIDER",
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

export type PrivateEnvironmentVariable =
  (typeof PRIVATE_ENVIRONMENT_VARIABLES)[number];

export function getRequiredServerEnvironmentVariable(
  name: PrivateEnvironmentVariable,
): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }

  return value;
}

export function getOptionalServerEnvironmentVariable(
  name: string,
): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

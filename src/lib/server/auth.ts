import "server-only";

import { normalizeAuthOrigin } from "@/lib/auth/auth-url";
import { createCollabAuth } from "@/lib/auth/server-factory";
import { configuredAuthEmailTransport } from "@/lib/server/auth-email";
import { isPublicSignupEnabled } from "@/lib/server/auth-settings";
import { database } from "@/lib/server/database";
import { getRequiredServerEnvironmentVariable } from "@/lib/server/env";

function readAuthSecret(): string {
  const secret = getRequiredServerEnvironmentVariable("BETTER_AUTH_SECRET");

  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres.");
  }

  return secret;
}

function readAuthBaseURL(): string {
  const value = getRequiredServerEnvironmentVariable("BETTER_AUTH_URL");
  return normalizeAuthOrigin(value, {
    allowLocalHttp: process.env.NODE_ENV !== "production",
  });
}

export const auth = createCollabAuth({
  database,
  baseURL: readAuthBaseURL(),
  secret: readAuthSecret(),
  emailTransport: configuredAuthEmailTransport,
  secureCookies: process.env.NODE_ENV === "production",
  publicSignupEnabled: isPublicSignupEnabled(),
});

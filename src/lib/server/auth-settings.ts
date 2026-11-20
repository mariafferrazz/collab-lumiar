import "server-only";

import { resolveResendEmailConfiguration } from "@/lib/auth/resend-email";
import { getOptionalServerEnvironmentVariable } from "@/lib/server/env";

export function readResendEmailConfiguration() {
  return resolveResendEmailConfiguration({
    provider: getOptionalServerEnvironmentVariable("AUTH_EMAIL_PROVIDER"),
    from: getOptionalServerEnvironmentVariable("AUTH_EMAIL_FROM"),
    apiKey: getOptionalServerEnvironmentVariable("RESEND_API_KEY"),
    baseURL: getOptionalServerEnvironmentVariable("BETTER_AUTH_URL"),
    nodeEnvironment: process.env.NODE_ENV,
  });
}

export function isAuthEmailConfigured(): boolean {
  try {
    readResendEmailConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function isPublicSignupEnabled(): boolean {
  return (
    getOptionalServerEnvironmentVariable("AUTH_PUBLIC_SIGNUP_ENABLED") ===
      "true" && isAuthEmailConfigured()
  );
}

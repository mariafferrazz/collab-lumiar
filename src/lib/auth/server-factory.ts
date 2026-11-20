import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin } from "better-auth/plugins";

import { account, session, user, verification } from "@/db/schema/auth";
import {
  accountRelations,
  sessionRelations,
  userRelations,
} from "@/db/schema/relations";
import { normalizeAuthOrigin } from "@/lib/auth/auth-url";
import type { AuthEmailTransport } from "@/lib/auth/email";
import {
  AUTH_ROLES,
  administratorRole,
  authAccessControl,
  customerRole,
} from "@/lib/auth/permissions";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";

export interface CollabAuthOptions {
  database: Parameters<typeof drizzleAdapter>[0];
  baseURL: string;
  secret: string;
  emailTransport: AuthEmailTransport;
  secureCookies?: boolean;
  publicSignupEnabled?: boolean;
  tokenExpiresInSeconds?: number;
}

function readTrustedOrigin(baseURL: string): string {
  return normalizeAuthOrigin(baseURL, { allowLocalHttp: true });
}

export function createCollabAuth(options: CollabAuthOptions) {
  const trustedOrigin = readTrustedOrigin(options.baseURL);
  const tokenExpiresInSeconds = options.tokenExpiresInSeconds ?? 60 * 60;

  return betterAuth({
    appName: "COLLAB LUMIAR",
    baseURL: trustedOrigin,
    secret: options.secret,
    trustedOrigins: [trustedOrigin],
    database: drizzleAdapter(options.database, {
      provider: "pg",
      transaction: true,
      schema: {
        user,
        session,
        account,
        verification,
        userRelations,
        sessionRelations,
        accountRelations,
      },
    }),
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
      },
      database: {
        generateId: "uuid",
        joins: true,
      },
      cookiePrefix: "collab",
      useSecureCookies: options.secureCookies ?? false,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: options.secureCookies ?? false,
        path: "/",
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      deferSessionRefresh: true,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: options.publicSignupEnabled !== true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: AUTH_PASSWORD_MIN_LENGTH,
      maxPasswordLength: AUTH_PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: tokenExpiresInSeconds,
      revokeSessionsOnPasswordReset: true,
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        role: AUTH_ROLES.customer,
        banned: false,
        banReason: null,
        banExpires: null,
        ...additionalFields,
        id,
      }),
      sendResetPassword: async ({ user: authUser, url }) => {
        await options.emailTransport.send({
          purpose: "password-reset",
          recipient: authUser.email,
          recipientName: authUser.name,
          actionUrl: url,
          expiresInSeconds: tokenExpiresInSeconds,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: tokenExpiresInSeconds,
      sendVerificationEmail: async ({ user: authUser, url }) => {
        await options.emailTransport.send({
          purpose: "email-verification",
          recipient: authUser.email,
          recipientName: authUser.name,
          actionUrl: url,
          expiresInSeconds: tokenExpiresInSeconds,
        });
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      storage: "memory",
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 8 },
        "/request-password-reset": { window: 60, max: 5 },
        "/reset-password": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
      },
    },
    plugins: [
      adminPlugin({
        ac: authAccessControl,
        roles: {
          CUSTOMER: customerRole,
          ADMIN: administratorRole,
        },
        defaultRole: AUTH_ROLES.customer,
        adminRoles: [AUTH_ROLES.admin],
        bannedUserMessage:
          "Não foi possível entrar. Entre em contato com a COLLAB.",
      }),
      nextCookies(),
    ],
  });
}

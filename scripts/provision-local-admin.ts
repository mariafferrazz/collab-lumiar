import { createInterface } from "node:readline/promises";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { MemoryAuthEmailTransport } from "@/lib/auth/email";
import { AUTH_ROLES } from "@/lib/auth/permissions";
import { createCollabAuth } from "@/lib/auth/server-factory";
import { validateRegistrationInput } from "@/lib/auth/validation";
import {
  assertLocalAdminEnvironment,
  readLocalAdminEnvironment,
} from "./lib/local-admin-environment";
import { assertLocalAdminDatabaseIdentity } from "./lib/local-admin-migration-runner";

const EXPECTED_MIGRATIONS = [
  "0000_collab_catalog",
  "0001_collab_auth",
  "0002_collab_financial_pricing",
] as const;

function fail(message: string): never {
  throw new Error(message);
}

async function readVisibleInputs() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return fail("Execute este comando em um terminal local interativo.");
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const name = await prompt.question("Nome da administradora local: ");
  const email = await prompt.question("E-mail administrativo local: ");
  prompt.close();
  return { name, email };
}

async function readHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return fail("A senha exige um terminal local interativo.");
  }

  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";

  try {
    return await new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        for (const byte of chunk) {
          if (byte === 3) {
            process.stdin.off("data", onData);
            reject(new Error("Provisionamento cancelado."));
            return;
          }
          if (byte === 13 || byte === 10) {
            process.stdin.off("data", onData);
            process.stdout.write("\n");
            resolve(value);
            return;
          }
          if (byte === 8 || byte === 127) {
            value = value.slice(0, -1);
            continue;
          }
          if (byte >= 32) value += String.fromCharCode(byte);
        }
      };
      process.stdin.on("data", onData);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}

function sessionCookie(response: Response): string {
  const value = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!value)
    return fail("O teste de sessão local não retornou cookie seguro.");
  return value;
}

async function verifyLoginAndLogout(
  auth: ReturnType<typeof createCollabAuth>,
  email: string,
  password: string,
) {
  const commonHeaders = {
    "content-type": "application/json",
    origin: "http://localhost:3000",
    "x-forwarded-for": "127.0.0.1",
  };
  const login = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({ email, password, rememberMe: false }),
    }),
  );
  if (!login.ok) return fail("A verificação do login local falhou.");

  const logout = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { ...commonHeaders, cookie: sessionCookie(login) },
      body: "{}",
    }),
  );
  if (!logout.ok) return fail("A verificação do logout local falhou.");
}

async function main() {
  const { environment } = await readLocalAdminEnvironment();
  const databaseUrl = assertLocalAdminEnvironment(environment);
  const client = postgres(databaseUrl.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
  });

  try {
    await assertLocalAdminDatabaseIdentity(client, databaseUrl);
    const ledger = await client<
      { migration_id: string; checksum_sha256: string }[]
    >`
      SELECT migration_id, btrim(checksum_sha256) AS checksum_sha256
      FROM collab_schema_migrations
      ORDER BY migration_id
    `;
    if (
      ledger.length !== EXPECTED_MIGRATIONS.length ||
      !ledger.every(
        (row, index) => row.migration_id === EXPECTED_MIGRATIONS[index],
      )
    ) {
      return fail(
        "As três migrations locais precisam estar íntegras e aplicadas.",
      );
    }

    const admins = await client<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM "user" WHERE role = 'ADMIN'
    `;
    if ((admins[0]?.total ?? 0) > 0) {
      return fail(
        "Já existe uma administradora local. Nenhuma segunda conta foi criada.",
      );
    }

    const { name, email } = await readVisibleInputs();
    const password = await readHidden("Senha local (não será exibida): ");
    const confirmation = await readHidden("Repita a senha local: ");
    const input = validateRegistrationInput({
      name,
      email,
      password,
      passwordConfirmation: confirmation,
    });
    if (!input.success) return fail(input.message);

    const auth = createCollabAuth({
      database: drizzle({ client, schema }),
      baseURL: environment.BETTER_AUTH_URL,
      secret: environment.BETTER_AUTH_SECRET,
      emailTransport: new MemoryAuthEmailTransport(),
      secureCookies: false,
      publicSignupEnabled: false,
    });
    const result = await auth.api.createUser({
      body: {
        name: input.data.name,
        email: input.data.email,
        password: input.data.password,
        role: AUTH_ROLES.admin,
        data: {
          emailVerified: true,
          banned: false,
          banReason: null,
          banExpires: null,
        },
      },
    });

    const rows = await client<
      {
        id: string;
        email_verified: boolean;
        role: string;
        banned: boolean;
        credential_password: string | null;
      }[]
    >`
      SELECT
        u.id::text,
        u.email_verified,
        u.role,
        u.banned,
        a.password AS credential_password
      FROM "user" u
      JOIN account a ON a.user_id = u.id AND a.provider_id = 'credential'
      WHERE u.id = ${result.user.id}
    `;
    const created = rows[0];
    if (
      !created ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        created.id,
      ) ||
      !created.email_verified ||
      created.role !== AUTH_ROLES.admin ||
      created.banned ||
      !created.credential_password ||
      created.credential_password === input.data.password
    ) {
      return fail("A conta local não passou pela verificação de segurança.");
    }

    await verifyLoginAndLogout(auth, input.data.email, input.data.password);
    console.log(
      "[local-admin] ADMIN local criado e login/logout validados. Nenhum e-mail foi enviado.",
    );
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    `[local-admin] ${
      error instanceof Error ? error.message : "Provisionamento local recusado."
    }`,
  );
  process.exitCode = 1;
});

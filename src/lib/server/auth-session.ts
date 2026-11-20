import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { hasAdminRole } from "@/lib/auth/permissions";
import { normalizeInternalRedirect } from "@/lib/auth/validation";
import { auth } from "@/lib/server/auth";

export const readSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export async function requireSession(nextPath = "/minha-conta") {
  const session = await readSession();

  if (!session) {
    const next = normalizeInternalRedirect(nextPath);
    redirect(`/entrar?next=${encodeURIComponent(next)}`);
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireSession("/admin");

  if (!hasAdminRole(session.user.role)) {
    redirect("/minha-conta?acesso=negado");
  }

  return session;
}

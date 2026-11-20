import type { Metadata } from "next";
import { Suspense } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { requireSession } from "@/lib/server/auth-session";

export const metadata: Metadata = {
  title: "Minha conta",
  description: "Área privada da conta de cliente da COLLAB LUMIAR.",
};

async function AccountDetails() {
  const session = await requireSession();

  return (
    <div className="rounded-[2rem] border border-brand/15 bg-surface p-6 shadow-[0_24px_70px_rgba(82,31,33,0.08)] sm:p-10">
      <p className="eyebrow">Minha conta</p>
      <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
        Olá, {session.user.name}.
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        Sua conta está protegida. Endereços, pedidos e preferências serão
        adicionados em etapas futuras com autorização por recurso no servidor.
      </p>
      <dl className="mt-8 grid gap-4 rounded-2xl bg-background p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-ink">E-mail</dt>
          <dd className="mt-1 break-all text-muted">{session.user.email}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink">Perfil</dt>
          <dd className="mt-1 text-muted">Cliente</dd>
        </div>
      </dl>
      <div className="mt-8">
        <LogoutButton />
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <main id="conteudo" className="page-shell py-12 sm:py-20">
      <Suspense
        fallback={
          <p className="rounded-2xl bg-surface p-6 text-muted" role="status">
            Verificando sua sessão…
          </p>
        }
      >
        <AccountDetails />
      </Suspense>
    </main>
  );
}

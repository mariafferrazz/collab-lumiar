import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { isPublicSignupEnabled } from "@/lib/server/auth-settings";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta de cliente na COLLAB LUMIAR.",
};

export default function SignUpPage() {
  const publicSignupEnabled = isPublicSignupEnabled();

  return (
    <AuthShell
      eyebrow="Cadastro de cliente"
      title="Um espaço para acompanhar sua história com a COLLAB."
      description="Comece com apenas nome, e-mail e senha. Endereço e outros dados serão solicitados somente quando forem realmente necessários."
      alternate={{
        text: "Já possui cadastro?",
        href: "/entrar",
        label: "Entrar",
      }}
    >
      {publicSignupEnabled ? (
        <RegisterForm />
      ) : (
        <div
          className="rounded-2xl border border-brand/20 bg-brand/5 p-5 text-sm leading-6 text-ink"
          role="status"
        >
          O cadastro público ainda não está disponível. A COLLAB está validando
          a infraestrutura segura de e-mail antes de liberar novas contas.
        </div>
      )}
    </AuthShell>
  );
}

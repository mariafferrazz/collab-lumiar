import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Solicite com segurança a recuperação da sua senha.",
};

export default function PasswordRecoveryPage() {
  return (
    <AuthShell
      eyebrow="Recuperação de acesso"
      title="Vamos ajudar você a voltar."
      description="Informe seu e-mail. Por segurança, a resposta não confirma se existe uma conta cadastrada."
      alternate={{
        text: "Lembrou sua senha?",
        href: "/entrar",
        label: "Voltar para entrar",
      }}
    >
      <PasswordRecoveryForm />
    </AuthShell>
  );
}

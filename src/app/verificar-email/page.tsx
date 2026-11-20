import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerificationEmailForm } from "@/components/auth/verification-email-form";

export const metadata: Metadata = {
  title: "Verificar e-mail",
  description: "Confirme seu e-mail para ativar o acesso à COLLAB.",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Confirmação de e-mail"
      title="Confira sua caixa de entrada."
      description="O acesso só será liberado depois da confirmação legítima do endereço de e-mail. Links expirados podem ser reenviados abaixo."
      alternate={{
        text: "E-mail já confirmado?",
        href: "/entrar",
        label: "Entrar",
      }}
    >
      <VerificationEmailForm />
    </AuthShell>
  );
}

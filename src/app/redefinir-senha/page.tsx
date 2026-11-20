import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha",
  description: "Defina uma nova senha para sua conta COLLAB.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Nova senha"
      title="Escolha uma nova senha segura."
      description="O link é temporário e só pode ser utilizado dentro do prazo de validade."
      alternate={{
        text: "O link expirou?",
        href: "/recuperar-senha",
        label: "Solicitar outro",
      }}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

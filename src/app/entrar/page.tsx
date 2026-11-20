import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { isPublicSignupEnabled } from "@/lib/server/auth-settings";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta protegida da COLLAB LUMIAR.",
};

export default function SignInPage() {
  const publicSignupEnabled = isPublicSignupEnabled();

  return (
    <AuthShell
      eyebrow="Acesso seguro"
      title="Que bom ter você de volta."
      description="Entre para acessar as áreas autorizadas da COLLAB com uma sessão protegida."
      alternate={
        publicSignupEnabled
          ? {
              text: "Ainda não tem uma conta?",
              href: "/cadastro",
              label: "Criar cadastro",
            }
          : undefined
      }
    >
      <LoginForm />
    </AuthShell>
  );
}

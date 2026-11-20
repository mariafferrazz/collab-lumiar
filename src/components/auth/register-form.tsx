"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  AuthField,
  AuthMessage,
  AuthSubmitButton,
} from "@/components/auth/auth-form-ui";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  validateRegistrationInput,
} from "@/lib/auth/validation";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const validation = validateRegistrationInput({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      passwordConfirmation: String(form.get("passwordConfirmation") ?? ""),
    });

    if (!validation.success) {
      setMessage(validation.message);
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.signUp.email({
        ...validation.data,
        callbackURL: "/verificar-email",
      });
      if (result.error) {
        setMessage(
          "Não foi possível concluir o cadastro. Tente novamente mais tarde.",
        );
        return;
      }
      router.push("/verificar-email");
    } catch {
      setMessage(
        "Não foi possível concluir o cadastro. Tente novamente mais tarde.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
      {message ? <AuthMessage>{message}</AuthMessage> : null}
      <AuthField
        id="name"
        name="name"
        label="Nome"
        autoComplete="name"
        minLength={2}
        maxLength={160}
        required
      />
      <AuthField
        id="email"
        name="email"
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={320}
        required
      />
      <AuthField
        id="password"
        name="password"
        label="Senha"
        type="password"
        autoComplete="new-password"
        minLength={AUTH_PASSWORD_MIN_LENGTH}
        maxLength={AUTH_PASSWORD_MAX_LENGTH}
        hint={`Use de ${AUTH_PASSWORD_MIN_LENGTH} a ${AUTH_PASSWORD_MAX_LENGTH} caracteres.`}
        required
      />
      <AuthField
        id="passwordConfirmation"
        name="passwordConfirmation"
        label="Confirme a senha"
        type="password"
        autoComplete="new-password"
        minLength={AUTH_PASSWORD_MIN_LENGTH}
        maxLength={AUTH_PASSWORD_MAX_LENGTH}
        required
      />
      <AuthSubmitButton busy={busy}>Criar minha conta</AuthSubmitButton>
      <p className="text-xs leading-5 text-muted">
        O cadastro público sempre recebe o papel de cliente. Permissões
        administrativas exigem provisionamento separado e autorizado.
      </p>
    </form>
  );
}

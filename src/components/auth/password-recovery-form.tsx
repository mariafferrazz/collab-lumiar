"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import {
  AuthField,
  AuthMessage,
  AuthSubmitButton,
} from "@/components/auth/auth-form-ui";
import { validateEmail } from "@/lib/auth/validation";
import { authClient } from "@/lib/auth-client";

const neutralMessage =
  "Se existir uma conta para esse e-mail, as instruções serão enviadas.";

export function PasswordRecoveryForm() {
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const email = validateEmail(String(form.get("email") ?? ""));

    if (!email.success) {
      setMessage(email.message);
      return;
    }

    setBusy(true);
    try {
      await authClient.requestPasswordReset({
        email: email.data,
        redirectTo: "/redefinir-senha",
      });
    } catch {
      // A resposta permanece neutra para não permitir enumeração de contas.
    } finally {
      setBusy(false);
      setSubmitted(true);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
      {message ? <AuthMessage>{message}</AuthMessage> : null}
      {submitted ? (
        <AuthMessage tone="success">{neutralMessage}</AuthMessage>
      ) : null}
      <AuthField
        id="email"
        name="email"
        label="E-mail da conta"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
      />
      <AuthSubmitButton busy={busy}>Enviar instruções</AuthSubmitButton>
    </form>
  );
}

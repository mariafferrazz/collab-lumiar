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

export function VerificationEmailForm() {
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
      await authClient.sendVerificationEmail({
        email: email.data,
        callbackURL: "/verificar-email",
      });
    } catch {
      // Mantém a resposta indistinguível para contas existentes e inexistentes.
    } finally {
      setBusy(false);
      setSubmitted(true);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
      {message ? <AuthMessage>{message}</AuthMessage> : null}
      {submitted ? (
        <AuthMessage tone="success">
          Se o cadastro estiver pendente, um novo link será enviado.
        </AuthMessage>
      ) : null}
      <AuthField
        id="email"
        name="email"
        label="E-mail do cadastro"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
      />
      <AuthSubmitButton busy={busy}>Reenviar confirmação</AuthSubmitButton>
    </form>
  );
}

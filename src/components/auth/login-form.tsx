"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  AuthField,
  AuthMessage,
  AuthSubmitButton,
} from "@/components/auth/auth-form-ui";
import {
  getAuthLoginMessage,
  readSafeAuthLoginError,
} from "@/lib/auth/login-error";
import {
  normalizeInternalRedirect,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("senha") === "alterada"
    ) {
      setSuccessMessage(
        "Senha redefinida. Você já pode entrar com a nova senha.",
      );
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const email = validateEmail(String(form.get("email") ?? ""));
    const password = validatePassword(String(form.get("password") ?? ""));

    if (!email.success || !password.success) {
      setMessage("Confira o e-mail e a senha informados.");
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.signIn.email({
        email: email.data,
        password: password.data,
        rememberMe: form.get("rememberMe") === "on",
      });
      if (result.error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[auth:sign-in] Better Auth recusou a tentativa.",
            readSafeAuthLoginError(result.error),
          );
        }
        setMessage(getAuthLoginMessage(result.error));
        return;
      }
      const next = normalizeInternalRedirect(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.push(next);
      router.refresh();
    } catch {
      setMessage("Não foi possível entrar agora. Tente novamente mais tarde.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
      {message ? <AuthMessage>{message}</AuthMessage> : null}
      {successMessage ? (
        <AuthMessage tone="success">{successMessage}</AuthMessage>
      ) : null}
      <AuthField
        id="email"
        name="email"
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
      />
      <AuthField
        id="password"
        name="password"
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-muted">
          <input
            className="size-4 accent-brand"
            type="checkbox"
            name="rememberMe"
            defaultChecked
          />
          Manter sessão neste dispositivo
        </label>
        <Link
          className="font-bold text-brand hover:text-brand-hover"
          href="/recuperar-senha"
        >
          Esqueci a senha
        </Link>
      </div>
      <AuthSubmitButton busy={busy}>Entrar</AuthSubmitButton>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function LogoutButton({
  tone = "default",
}: {
  tone?: "default" | "on-dark";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
      router.push("/entrar");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`button-secondary ${tone === "on-dark" ? "button-secondary-on-dark" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
      type="button"
      onClick={signOut}
      disabled={busy}
    >
      {busy ? "Encerrando…" : "Sair da conta"}
    </button>
  );
}

import type { InputHTMLAttributes, ReactNode } from "react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function AuthField({ label, hint, id, ...props }: AuthFieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;

  return (
    <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor={id}>
      {label}
      <input
        {...props}
        id={id}
        aria-describedby={hintId}
        className="min-h-12 rounded-xl border border-border bg-background px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {hint ? (
        <span id={hintId} className="text-xs font-normal leading-5 text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function AuthMessage({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
        tone === "success"
          ? "border-success/25 bg-success/10 text-success"
          : "border-error/25 bg-error/10 text-error"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function AuthSubmitButton({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      type="submit"
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? "Aguarde…" : children}
    </button>
  );
}

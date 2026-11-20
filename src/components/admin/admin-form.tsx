"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { createContext, useActionState, useContext } from "react";

import type { AdminActionState } from "@/lib/admin/types";
import { initialAdminActionState } from "@/lib/admin/types";

type AdminFormAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

const StateContext = createContext<AdminActionState>(initialAdminActionState);

function FieldErrors({ name }: { name: string }) {
  const state = useContext(StateContext);
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return (
    <span className="text-xs font-medium text-error" id={`${name}-error`}>
      {errors.join(" ")}
    </span>
  );
}

export function AdminActionForm({
  action,
  submitLabel,
  children,
  className = "grid gap-6",
}: {
  action: AdminFormAction;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAdminActionState,
  );

  return (
    <StateContext.Provider value={state}>
      <form action={formAction} className={className} noValidate>
        {state.message ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              state.status === "success"
                ? "border-success/25 bg-success/10 text-success"
                : "border-error/25 bg-error/10 text-error"
            }`}
            role={state.status === "success" ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
        {children}
        <button
          aria-busy={pending}
          className="button-primary w-full sm:w-fit"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando…" : submitLabel}
        </button>
      </form>
    </StateContext.Provider>
  );
}

export function AdminTextField({
  label,
  hint,
  name,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <label className="grid gap-2 text-sm font-bold text-ink">
      {label}
      <input
        {...props}
        aria-describedby={errorId}
        className="min-h-12 rounded-xl border border-border bg-background px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
      />
      {hint ? (
        <span className="text-xs font-normal text-muted">{hint}</span>
      ) : null}
      <FieldErrors name={name} />
    </label>
  );
}

export function AdminTextareaField({
  label,
  hint,
  name,
  defaultValue,
  rows = 6,
  required,
}: {
  label: string;
  hint?: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-ink">
      {label}
      <textarea
        aria-describedby={`${name}-error`}
        className="rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        defaultValue={defaultValue ?? ""}
        name={name}
        required={required}
        rows={rows}
      />
      {hint ? (
        <span className="text-xs font-normal text-muted">{hint}</span>
      ) : null}
      <FieldErrors name={name} />
    </label>
  );
}

export function AdminSelectField({
  label,
  name,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-ink">
      {label}
      <select
        {...props}
        aria-describedby={`${name}-error`}
        className="min-h-12 rounded-xl border border-border bg-background px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
      >
        {children}
      </select>
      <FieldErrors name={name} />
    </label>
  );
}

export function AdminCheckboxField({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-sm text-ink">
      <input
        className="mt-1 size-4 accent-brand"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      <span>
        <strong>{label}</strong>
        {hint ? (
          <span className="mt-1 block text-xs text-muted">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

export function AdminMutationForm({
  action,
  fields,
  label,
  confirmMessage,
  tone = "secondary",
}: {
  action: AdminFormAction;
  fields: Record<string, string>;
  label: string;
  confirmMessage?: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAdminActionState,
  );
  const className =
    tone === "primary"
      ? "button-primary"
      : tone === "danger"
        ? "inline-flex min-h-10 items-center justify-center rounded-full border border-error/35 px-4 text-xs font-bold text-error hover:bg-error hover:text-white"
        : "button-secondary min-h-10 px-4 text-xs";

  return (
    <form
      action={formAction}
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <button className={className} disabled={pending} type="submit">
        {pending ? "Aguarde…" : label}
      </button>
      {state.message ? (
        <span
          className={`text-xs ${state.status === "success" ? "text-success" : "text-error"}`}
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

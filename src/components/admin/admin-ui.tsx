import Link from "next/link";
import type { ReactNode } from "react";

export interface AdminBreadcrumbItem {
  label: string;
  href?: string;
}

export function AdminBreadcrumbs({ items }: { items: AdminBreadcrumbItem[] }) {
  return (
    <nav aria-label="Caminho da página" className="mb-5 text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li className="flex items-center gap-2" key={item.href ?? item.label}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link className="font-bold hover:text-brand" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="rounded-[1.75rem] border border-brand/12 bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl leading-none text-brand sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

export function AdminMetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <article className="rounded-2xl border border-brand/12 bg-surface p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl text-brand">{value}</p>
      {note ? (
        <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
      ) : null}
    </article>
  );
}

export function AdminStatusBadge({
  status,
}: {
  status: "active" | "inactive" | "draft" | "published" | "archived" | "empty";
}) {
  const labels = {
    active: "Ativo",
    inactive: "Inativo",
    draft: "Rascunho",
    published: "Publicado",
    archived: "Arquivado",
    empty: "Sem estoque",
  } as const;
  const styles =
    status === "published" || status === "active"
      ? "bg-success/10 text-success"
      : status === "empty" || status === "inactive"
        ? "bg-error/10 text-error"
        : "bg-brand/8 text-brand";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles}`}
    >
      {labels[status]}
    </span>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-brand/25 bg-surface/70 p-8 text-center">
      <h2 className="font-display text-3xl text-brand">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function AdminPagination({
  basePath,
  page,
  total,
  pageSize,
  query,
  status,
}: {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
  query?: string;
  status?: string | null;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(nextPage: number) {
    const parameters = new URLSearchParams();
    if (query) parameters.set("q", query);
    if (status) parameters.set("status", status);
    parameters.set("page", String(nextPage));
    return `${basePath}?${parameters.toString()}`;
  }

  return (
    <nav
      className="mt-6 flex items-center justify-between gap-3 text-sm"
      aria-label="Paginação"
    >
      {page > 1 ? (
        <Link className="button-secondary" href={href(page - 1)}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="button-secondary" href={href(page + 1)}>
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function AdminLoadingState() {
  return (
    <div
      className="rounded-2xl border border-brand/12 bg-surface p-8"
      role="status"
    >
      <p className="animate-pulse text-sm font-bold text-brand">
        Carregando dados administrativos…
      </p>
    </div>
  );
}

export function AdminListFilters({
  action,
  query,
  status,
  statusOptions = [],
}: {
  action: string;
  query?: string;
  status?: string | null;
  statusOptions?: { value: string; label: string }[];
}) {
  return (
    <form
      action={action}
      className="mt-6 grid gap-3 rounded-2xl border border-brand/12 bg-surface p-4 sm:grid-cols-[minmax(12rem,1fr)_12rem_auto]"
    >
      <label className="grid gap-1 text-xs font-bold text-muted">
        Buscar
        <input
          className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-normal text-ink outline-none focus:border-brand"
          defaultValue={query}
          maxLength={120}
          name="q"
          placeholder="Nome, slug ou SKU"
          type="search"
        />
      </label>
      {statusOptions.length > 0 ? (
        <label className="grid gap-1 text-xs font-bold text-muted">
          Status
          <select
            className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-normal text-ink outline-none focus:border-brand"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">Todos</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span />
      )}
      <button className="button-primary self-end" type="submit">
        Filtrar
      </button>
    </form>
  );
}

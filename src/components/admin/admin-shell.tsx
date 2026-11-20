import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { CollabLogo } from "@/components/brand/collab-logo";

const adminNavigation = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/artistas", label: "Artistas" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/estoque", label: "Estoque" },
  { href: "/admin/financeiro", label: "Financeiro" },
];

function AdminNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label="Navegação administrativa">
      <ul className={mobile ? "grid gap-1" : "grid gap-2"}>
        {adminNavigation.map((item) => (
          <li key={item.href}>
            <Link
              className={
                mobile
                  ? "block rounded-xl px-4 py-3 text-sm font-bold text-ink hover:bg-brand/10 hover:text-brand"
                  : "block rounded-xl px-4 py-3 text-sm font-bold text-cream/80 hover:bg-cream/10 hover:text-cream"
              }
              href={item.href}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mb-5 rounded-2xl border border-brand/15 bg-surface p-3 lg:hidden">
        <details>
          <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-bold text-brand [&::-webkit-details-marker]:hidden">
            Menu administrativo
          </summary>
          <div className="mt-2 border-t border-brand/10 pt-3">
            <AdminNavigation mobile />
          </div>
        </details>
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-28 hidden h-[calc(100vh-9rem)] rounded-[1.75rem] bg-brand p-5 text-cream lg:flex lg:flex-col">
          <Link
            className="rounded-xl bg-cream p-3"
            href="/"
            aria-label="Voltar para a loja COLLAB"
          >
            <CollabLogo className="w-full" />
          </Link>
          <p className="mt-5 px-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-cream/55">
            Administração
          </p>
          <div className="mt-3">
            <AdminNavigation />
          </div>
          <div className="mt-auto border-t border-cream/15 px-3 pt-5 text-xs leading-5 text-cream/65">
            Sessão protegida de{" "}
            <strong className="text-cream">{userName}</strong>
            <div className="mt-4">
              <LogoutButton tone="on-dark" />
            </div>
          </div>
        </aside>

        <main id="conteudo" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

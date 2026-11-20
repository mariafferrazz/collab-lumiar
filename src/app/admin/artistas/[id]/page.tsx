import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { isUuid } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = {
  title: "Detalhes do artista — Administração",
};

export default async function ArtistDetailPage({
  params,
}: PageProps<"/admin/artistas/[id]">) {
  await requireAdminSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detail = await adminCatalog.artist(id);
  if (!detail) notFound();

  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Artistas", href: "/admin/artistas" },
          { label: detail.artist.artisticName },
        ]}
      />
      <AdminPageHeader
        action={
          <Link
            className="button-primary"
            href={`/admin/artistas/${id}/editar`}
          >
            Editar perfil
          </Link>
        }
        description={detail.artist.biography}
        eyebrow="Perfil do artista"
        title={detail.artist.artisticName}
      />
      <section className="grid gap-4 rounded-2xl border border-brand/12 bg-surface p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase text-muted">Status</p>
          <div className="mt-2">
            <AdminStatusBadge
              status={detail.artist.isActive ? "active" : "inactive"}
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted">Instagram</p>
          <p className="mt-2 text-sm">
            {detail.artist.instagramHandle
              ? `@${detail.artist.instagramHandle}`
              : "Não informado"}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-muted">
            Produtos vinculados
          </p>
          <p className="mt-2 font-display text-3xl text-brand">
            {detail.products.length}
          </p>
        </div>
      </section>
      <section>
        <h2 className="font-display text-3xl text-brand">
          Produtos do artista
        </h2>
        {detail.products.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {detail.products.map((product) => (
              <li
                className="rounded-xl border border-brand/12 bg-surface p-4"
                key={product.id}
              >
                <Link
                  className="font-bold hover:text-brand"
                  href={`/admin/produtos/${product.id}`}
                >
                  {product.name}
                </Link>
                <div className="mt-2">
                  <AdminStatusBadge status={product.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmptyState
            description="Este artista ainda não possui produtos persistidos."
            title="Nenhum produto vinculado"
          />
        )}
      </section>
    </div>
  );
}

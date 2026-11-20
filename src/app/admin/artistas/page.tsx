import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { setArtistStatusAction } from "@/app/admin/actions";
import { AdminMutationForm } from "@/components/admin/admin-form";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminListFilters,
  AdminLoadingState,
  AdminPageHeader,
  AdminPagination,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { readAdminListParameters } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Artistas — Administração" };

async function ArtistsContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  await requireAdminSession();
  const parameters = await searchParams;
  const input = readAdminListParameters({
    query: parameters.q,
    page: parameters.page,
    status: parameters.status,
  });
  const result = await adminCatalog.listArtists(input);

  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Artistas" },
        ]}
      />
      <AdminPageHeader
        action={
          <Link className="button-primary" href="/admin/artistas/novo">
            Novo artista
          </Link>
        }
        description="Cadastre perfis públicos, acompanhe vínculos e prefira desativação para preservar a integridade histórica."
        eyebrow="Catálogo"
        title="Artistas"
      />
      <AdminListFilters
        action="/admin/artistas"
        query={input.query}
        status={input.status}
        statusOptions={[
          { value: "active", label: "Ativos" },
          { value: "inactive", label: "Inativos" },
        ]}
      />

      {result.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-brand/12 bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand/12 bg-brand/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-4">Artista</th>
                <th className="px-5 py-4">Produtos</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              {result.rows.map((artist) => (
                <tr key={artist.id}>
                  <td className="px-5 py-4">
                    <Link
                      className="font-bold text-ink hover:text-brand"
                      href={`/admin/artistas/${artist.id}`}
                    >
                      {artist.artisticName}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {artist.instagramHandle
                        ? `@${artist.instagramHandle}`
                        : "Sem Instagram"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {artist.productCount}
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge
                      status={artist.isActive ? "active" : "inactive"}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="button-secondary min-h-10 px-4 text-xs"
                        href={`/admin/artistas/${artist.id}/editar`}
                      >
                        Editar
                      </Link>
                      <AdminMutationForm
                        action={setArtistStatusAction}
                        confirmMessage={
                          artist.isActive
                            ? "Desativar este artista preservando seus produtos?"
                            : undefined
                        }
                        fields={{
                          id: artist.id,
                          active: String(!artist.isActive),
                        }}
                        label={artist.isActive ? "Desativar" : "Ativar"}
                        tone={artist.isActive ? "danger" : "secondary"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmptyState
          action={
            <Link className="button-primary" href="/admin/artistas/novo">
              Cadastrar artista
            </Link>
          }
          description="Nenhum artista corresponde aos filtros atuais."
          title="Lista vazia"
        />
      )}
      <AdminPagination
        basePath="/admin/artistas"
        page={input.page}
        pageSize={input.pageSize}
        query={input.query}
        status={input.status}
        total={result.total}
      />
    </div>
  );
}

export default function ArtistsAdminPage({
  searchParams,
}: PageProps<"/admin/artistas">) {
  return (
    <Suspense fallback={<AdminLoadingState />}>
      <ArtistsContent searchParams={searchParams} />
    </Suspense>
  );
}

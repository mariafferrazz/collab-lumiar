import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { deleteCategoryAction } from "@/app/admin/actions";
import { AdminMutationForm } from "@/components/admin/admin-form";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminListFilters,
  AdminLoadingState,
  AdminPageHeader,
  AdminPagination,
} from "@/components/admin/admin-ui";
import { readAdminListParameters } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Categorias — Administração" };

async function CategoriesContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const parameters = await searchParams;
  const input = readAdminListParameters({
    query: parameters.q,
    page: parameters.page,
  });
  const result = await adminCatalog.listCategories(input);
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Categorias" },
        ]}
      />
      <AdminPageHeader
        action={
          <Link className="button-primary" href="/admin/categorias/nova">
            Nova categoria
          </Link>
        }
        description="Organize tipos de produto em uma hierarquia sem ciclos. O schema atual não possui status ativo/inativo para categorias."
        eyebrow="Catálogo"
        title="Categorias"
      />
      <AdminListFilters action="/admin/categorias" query={input.query} />
      {result.rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-brand/12 bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand/12 bg-brand/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-4">Categoria</th>
                <th className="px-5 py-4">Hierarquia</th>
                <th className="px-5 py-4">Produtos</th>
                <th className="px-5 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              {result.rows.map((category) => (
                <tr key={category.id}>
                  <td className="px-5 py-4">
                    <strong>{category.name}</strong>
                    <p className="mt-1 text-xs text-muted">
                      /{category.slug} · ordem {category.displayOrder}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {category.parentName ?? "Principal"}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {category.productCount}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="button-secondary min-h-10 px-4 text-xs"
                        href={`/admin/categorias/${category.id}/editar`}
                      >
                        Editar
                      </Link>
                      <AdminMutationForm
                        action={deleteCategoryAction}
                        confirmMessage="Remover esta categoria? A operação será bloqueada se houver produtos ou subcategorias."
                        fields={{ id: category.id }}
                        label="Remover"
                        tone="danger"
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
            <Link className="button-primary" href="/admin/categorias/nova">
              Criar categoria
            </Link>
          }
          description="Nenhuma categoria corresponde aos filtros atuais."
          title="Lista vazia"
        />
      )}
      <AdminPagination
        basePath="/admin/categorias"
        page={input.page}
        pageSize={input.pageSize}
        query={input.query}
        total={result.total}
      />
    </div>
  );
}

export default function CategoriesAdminPage({
  searchParams,
}: PageProps<"/admin/categorias">) {
  return (
    <Suspense fallback={<AdminLoadingState />}>
      <CategoriesContent searchParams={searchParams} />
    </Suspense>
  );
}

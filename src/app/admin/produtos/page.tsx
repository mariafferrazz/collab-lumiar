import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { setProductStatusAction } from "@/app/admin/actions";
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
import { formatPrice } from "@/lib/format";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Produtos — Administração" };

async function ProductsContent({
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
  const result = await adminCatalog.listProducts(input);
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Produtos" },
        ]}
      />
      <AdminPageHeader
        action={
          <Link className="button-primary" href="/admin/produtos/novo">
            Novo produto
          </Link>
        }
        description="Gerencie rascunhos, preços em centavos, categorias, variações, estoque e os requisitos para publicação."
        eyebrow="Catálogo"
        title="Produtos"
      />
      <AdminListFilters
        action="/admin/produtos"
        query={input.query}
        status={input.status}
        statusOptions={[
          { value: "draft", label: "Rascunhos" },
          { value: "published", label: "Publicados" },
          { value: "archived", label: "Arquivados" },
        ]}
      />
      {result.rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-brand/12 bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand/12 bg-brand/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-4">Produto</th>
                <th className="px-5 py-4">Preço</th>
                <th className="px-5 py-4">Estoque</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              {result.rows.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-4">
                    <Link
                      className="font-bold hover:text-brand"
                      href={`/admin/produtos/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {product.artistName} · /{product.slug}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {formatPrice(product.priceInCents)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        product.stock === 0
                          ? "font-bold text-error"
                          : "text-muted"
                      }
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge status={product.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="button-secondary min-h-10 px-4 text-xs"
                        href={`/admin/produtos/${product.id}/preview`}
                      >
                        Prévia
                      </Link>
                      <Link
                        className="button-secondary min-h-10 px-4 text-xs"
                        href={`/admin/produtos/${product.id}/editar`}
                      >
                        Editar
                      </Link>
                      {product.status !== "archived" ? (
                        <AdminMutationForm
                          action={setProductStatusAction}
                          confirmMessage="Arquivar este produto? Ele deixará de ser elegível para a vitrine futura."
                          fields={{ id: product.id, status: "archived" }}
                          label="Arquivar"
                          tone="danger"
                        />
                      ) : (
                        <AdminMutationForm
                          action={setProductStatusAction}
                          fields={{ id: product.id, status: "draft" }}
                          label="Reabrir"
                        />
                      )}
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
            <Link className="button-primary" href="/admin/produtos/novo">
              Criar produto
            </Link>
          }
          description="Nenhum produto corresponde aos filtros atuais."
          title="Lista vazia"
        />
      )}
      <AdminPagination
        basePath="/admin/produtos"
        page={input.page}
        pageSize={input.pageSize}
        query={input.query}
        status={input.status}
        total={result.total}
      />
    </div>
  );
}

export default function ProductsAdminPage({
  searchParams,
}: PageProps<"/admin/produtos">) {
  return (
    <Suspense fallback={<AdminLoadingState />}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

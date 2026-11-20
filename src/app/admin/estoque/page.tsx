import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { updateStockAction } from "@/app/admin/actions";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminListFilters,
  AdminLoadingState,
  AdminPageHeader,
  AdminPagination,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { StockAdjustmentForm } from "@/components/admin/product-dependent-forms";
import { readAdminListParameters } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Estoque — Administração" };

async function StockContent({
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
  const result = await adminCatalog.listStock(input);
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Estoque" },
        ]}
      />
      <AdminPageHeader
        description="Atualizações usam controle otimista pelo timestamp da variação para evitar sobrescrever uma alteração concorrente."
        eyebrow="Operação"
        title="Estoque"
      />
      <AdminListFilters
        action="/admin/estoque"
        query={input.query}
        status={input.status}
        statusOptions={[
          { value: "available", label: "Disponível" },
          { value: "empty", label: "Zerado" },
        ]}
      />
      <p className="rounded-xl border border-brand/15 bg-brand/5 p-4 text-xs leading-5 text-muted">
        O schema atual não possui histórico de movimentações. Os ajustes alteram
        somente a quantidade atual; auditoria de estoque, reservas e baixa por
        pedidos exigem uma etapa futura e migration própria.
      </p>
      {result.rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-brand/12 bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand/12 bg-brand/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-4">Produto / SKU</th>
                <th className="px-5 py-4">Atributos</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Ajuste autorizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              {result.rows.map((variation) => (
                <tr key={variation.id}>
                  <td className="px-5 py-4">
                    <Link
                      className="font-bold hover:text-brand"
                      href={`/admin/produtos/${variation.productId}`}
                    >
                      {variation.productName}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {variation.sku}
                      {variation.isDefault ? " · padrão" : ""}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {[variation.color, variation.size]
                      .filter(Boolean)
                      .join(" · ") || "Sem atributos"}
                  </td>
                  <td className="px-5 py-4">
                    {variation.availableQuantity === 0 ? (
                      <AdminStatusBadge status="empty" />
                    ) : (
                      <span className="font-bold text-success">
                        {variation.availableQuantity} disponível(is)
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StockAdjustmentForm
                      action={updateStockAction}
                      quantity={variation.availableQuantity}
                      updatedAt={variation.updatedAt}
                      variationId={variation.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmptyState
          description="Nenhuma variação corresponde aos filtros. O estoque nasce junto das variações dos produtos."
          title="Estoque vazio"
        />
      )}
      <AdminPagination
        basePath="/admin/estoque"
        page={input.page}
        pageSize={input.pageSize}
        query={input.query}
        status={input.status}
        total={result.total}
      />
    </div>
  );
}

export default function StockAdminPage({
  searchParams,
}: PageProps<"/admin/estoque">) {
  return (
    <Suspense fallback={<AdminLoadingState />}>
      <StockContent searchParams={searchParams} />
    </Suspense>
  );
}

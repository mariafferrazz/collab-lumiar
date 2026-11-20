import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminLoadingState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = {
  title: "Administração",
  description: "Painel protegido de gestão do catálogo COLLAB LUMIAR.",
};

async function DashboardContent() {
  await requireAdminSession();
  const dashboard = await adminCatalog.dashboard();
  const { metrics } = dashboard;

  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs items={[{ label: "Administração" }]} />
      <AdminPageHeader
        eyebrow="Painel administrativo"
        title="Visão geral do catálogo"
        description="Indicadores calculados diretamente das tabelas de domínio. Pedidos, vendas e métricas financeiras ainda não existem e não são simulados."
        action={
          <Link className="button-primary" href="/admin/produtos/novo">
            Novo produto
          </Link>
        }
      />

      <section aria-labelledby="catalogo-indicadores">
        <h2 className="sr-only" id="catalogo-indicadores">
          Indicadores do catálogo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Artistas" value={metrics.artistsTotal} />
          <AdminMetricCard
            label="Artistas ativos"
            value={metrics.artistsActive}
          />
          <AdminMetricCard label="Produtos" value={metrics.productsTotal} />
          <AdminMetricCard
            label="Publicados"
            value={metrics.productsPublished}
          />
          <AdminMetricCard label="Rascunhos" value={metrics.productsDraft} />
          <AdminMetricCard
            label="Arquivados"
            value={metrics.productsArchived}
          />
          <AdminMetricCard
            label="Sem estoque"
            note="Sem variação ativa com quantidade disponível."
            value={metrics.productsOutOfStock}
          />
          <AdminMetricCard label="Categorias" value={metrics.categoriesTotal} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl text-brand">
              Produtos recentes
            </h2>
            <Link className="text-link" href="/admin/produtos">
              Ver todos
            </Link>
          </div>
          {dashboard.recentProducts.length > 0 ? (
            <ul className="mt-5 divide-y divide-brand/10">
              {dashboard.recentProducts.map((product) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={product.id}
                >
                  <div>
                    <Link
                      className="font-bold text-ink hover:text-brand"
                      href={`/admin/produtos/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {product.artistName}
                    </p>
                  </div>
                  <AdminStatusBadge status={product.status} />
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState
              description="Crie primeiro um artista e depois um produto em rascunho."
              title="Nenhum produto persistido"
            />
          )}
        </section>

        <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl text-brand">
              Precisa de atenção
            </h2>
            <Link className="text-link" href="/admin/estoque">
              Ver estoque
            </Link>
          </div>
          {dashboard.attentionProducts.length > 0 ? (
            <ul className="mt-5 divide-y divide-brand/10">
              {dashboard.attentionProducts.map((product) => (
                <li className="py-4" key={product.id}>
                  <Link
                    className="font-bold text-ink hover:text-brand"
                    href={`/admin/produtos/${product.id}`}
                  >
                    {product.name}
                  </Link>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {product.categoryCount === 0 ? "Sem categoria · " : ""}
                    {product.imageCount === 0 ? "Sem imagem · " : ""}
                    {product.stock === 0
                      ? "Sem estoque"
                      : `${product.stock} unidade(s)`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState
              description="Os produtos atuais não apresentam pendências básicas."
              title="Tudo em ordem"
            />
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
          <h2 className="font-display text-3xl text-brand">
            Artistas recentes
          </h2>
          {dashboard.recentArtists.length > 0 ? (
            <ul className="mt-5 divide-y divide-brand/10">
              {dashboard.recentArtists.map((artist) => (
                <li
                  className="flex items-center justify-between gap-4 py-4"
                  key={artist.id}
                >
                  <Link
                    className="font-bold hover:text-brand"
                    href={`/admin/artistas/${artist.id}`}
                  >
                    {artist.name}
                  </Link>
                  <AdminStatusBadge
                    status={artist.isActive ? "active" : "inactive"}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Nenhum artista cadastrado.
            </p>
          )}
        </section>

        <aside className="rounded-[1.5rem] border border-brand/12 bg-brand p-6 text-cream">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-cream/60">
            Próxima etapa
          </p>
          <h2 className="mt-3 font-display text-3xl">Pedidos e resultados</h2>
          <p className="mt-4 text-sm leading-6 text-cream/75">
            Disponível em uma próxima etapa. Não há pedidos, vendas,
            faturamento, lucro ou conversões calculados neste painel.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoadingState />}>
      <DashboardContent />
    </Suspense>
  );
}

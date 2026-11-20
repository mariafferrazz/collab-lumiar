import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CatalogModeNotice } from "@/components/catalog/catalog-mode-notice";
import { ProductGrid } from "@/components/product/product-grid";
import { SearchIcon } from "@/components/ui/icons";
import { readPublicProductSearchInput } from "@/lib/catalog/public-query";
import { publicCatalog } from "@/lib/server/catalog";
import type { PublicProductSearchInput } from "@/types/public-catalog";

export const metadata: Metadata = {
  title: "Produtos",
  description:
    "Explore produtos autorais publicados por artistas da região serrana do Rio.",
};

function catalogHref(input: PublicProductSearchInput, page: number): string {
  const parameters = new URLSearchParams();
  if (input.query) parameters.set("q", input.query);
  if (input.category) parameters.set("categoria", input.category);
  if (input.artist) parameters.set("artista", input.artist);
  if (input.availability !== "all") {
    parameters.set("disponibilidade", input.availability);
  }
  if (input.sort !== "newest") parameters.set("ordem", input.sort);
  if (page > 1) parameters.set("pagina", String(page));
  const query = parameters.toString();
  return query ? `/produtos?${query}` : "/produtos";
}

async function ProductsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const input = readPublicProductSearchInput({
    q: parameters.q,
    categoria: parameters.categoria,
    artista: parameters.artista,
    disponibilidade: parameters.disponibilidade,
    ordem: parameters.ordem,
    pagina: parameters.pagina,
  });
  const [result, categories] = await Promise.all([
    publicCatalog.searchProducts(input),
    publicCatalog.categories(),
  ]);
  const source = publicCatalog.source();

  return (
    <main id="conteudo">
      <section className="page-shell py-12 sm:py-20">
        <p className="eyebrow">
          {source === "demo" ? "Catálogo demonstrativo" : "Catálogo publicado"}
        </p>
        <div className="mt-4 grid gap-7 border-b border-brand/20 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <h1 className="max-w-4xl font-display text-6xl leading-[0.87] tracking-[-0.055em] text-ink sm:text-8xl">
            Feito por aqui, para ficar com você.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-ink/65 lg:justify-self-end">
            Descubra peças autorais por artista, categoria e disponibilidade. O
            preço apresentado é o valor final aprovado da mercadoria.
          </p>
        </div>
      </section>

      <section className="page-shell pb-14" aria-labelledby="categorias-title">
        <h2 id="categorias-title" className="sr-only">
          Categorias
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              className="rounded-[1.4rem] border border-brand/12 bg-surface p-5"
              href={`/categorias/${category.slug}`}
            >
              <span className="text-xs font-bold text-brand">
                {String(index + 1).padStart(2, "0")}
                {category.parentSlug ? " · subcategoria" : ""}
              </span>
              <h3 className="mt-4 font-display text-3xl text-ink">
                {category.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {category.description ?? "Categoria da curadoria COLLAB."}
              </p>
              <p className="mt-3 text-xs font-bold text-brand">
                {category.productCount}{" "}
                {category.productCount === 1
                  ? "produto publicado"
                  : "produtos publicados"}
              </p>
            </Link>
          ))}
        </div>
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand/20 p-6 text-sm text-ink/60">
            Nenhuma categoria possui produtos públicos neste catálogo.
          </p>
        ) : null}
      </section>

      <section id="catalogo" className="bg-sand/45 py-14 sm:py-20">
        <div className="page-shell">
          <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Todos os produtos</p>
              <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
                {result.total} {result.total === 1 ? "criação" : "criações"}
              </h2>
            </div>

            <form
              action="/produtos"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_11rem_11rem_11rem_auto]"
            >
              <label className="relative">
                <span className="sr-only">Pesquisar produtos</span>
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/45" />
                <input
                  type="search"
                  name="q"
                  defaultValue={input.query}
                  placeholder="Produto ou artista"
                  className="h-12 w-full rounded-full border border-ink/15 bg-paper pl-11 pr-4 text-sm placeholder:text-ink/40"
                />
              </label>
              <label>
                <span className="sr-only">Filtrar por categoria</span>
                <select
                  name="categoria"
                  defaultValue={input.category ?? ""}
                  className="h-12 w-full rounded-full border border-ink/15 bg-paper px-4 text-sm text-ink/70"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.parentSlug ? "↳ " : ""}
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filtrar por disponibilidade</span>
                <select
                  name="disponibilidade"
                  defaultValue={input.availability}
                  className="h-12 w-full rounded-full border border-ink/15 bg-paper px-4 text-sm text-ink/70"
                >
                  <option value="all">Todo o estoque</option>
                  <option value="in-stock">Disponíveis</option>
                  <option value="out-of-stock">Esgotados</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Ordenar produtos</span>
                <select
                  name="ordem"
                  defaultValue={input.sort}
                  className="h-12 w-full rounded-full border border-ink/15 bg-paper px-4 text-sm text-ink/70"
                >
                  <option value="newest">Novidades</option>
                  <option value="name-asc">Nome: A–Z</option>
                  <option value="name-desc">Nome: Z–A</option>
                  <option value="price-asc">Menor preço</option>
                  <option value="price-desc">Maior preço</option>
                </select>
              </label>
              <button
                type="submit"
                className="h-12 rounded-full bg-brand px-5 text-sm font-bold text-cream"
              >
                Filtrar
              </button>
            </form>
          </div>
          <div className="mb-8">
            <CatalogModeNotice source={source} />
          </div>
          {result.rows.length ? (
            <ProductGrid products={result.rows} eagerFirstImage />
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-brand/20 bg-paper p-8 text-center">
              <h3 className="font-display text-3xl text-ink">
                Nenhum produto encontrado
              </h3>
              <p className="mt-2 text-sm text-ink/60">
                Ajuste os filtros ou aguarde a publicação de novos produtos.
              </p>
            </div>
          )}
          {result.totalPages > 1 ? (
            <nav
              className="mt-10 flex items-center justify-center gap-3"
              aria-label="Paginação do catálogo"
            >
              {result.page > 1 ? (
                <Link
                  className="button-secondary"
                  href={catalogHref(input, result.page - 1)}
                >
                  Anterior
                </Link>
              ) : null}
              <span className="text-sm text-ink/60">
                Página {result.page} de {result.totalPages}
              </span>
              {result.page < result.totalPages ? (
                <Link
                  className="button-secondary"
                  href={catalogHref(input, result.page + 1)}
                >
                  Próxima
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function ProductsPage({ searchParams }: PageProps<"/produtos">) {
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="page-shell py-20 text-sm text-ink/60">
          Carregando o catálogo…
        </main>
      }
    >
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

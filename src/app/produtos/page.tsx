import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/product-grid";
import { SearchIcon } from "@/components/ui/icons";
import { categories, products } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Produtos",
  description:
    "Explore produtos autorais demonstrativos de artistas da região serrana do Rio.",
};

export default function ProductsPage() {
  return (
    <main id="conteudo">
      <section className="page-shell py-12 sm:py-20">
        <p className="eyebrow">Catálogo demonstrativo</p>
        <div className="mt-4 grid gap-7 border-b border-brand/20 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <h1 className="max-w-4xl font-display text-6xl leading-[0.87] tracking-[-0.055em] text-ink sm:text-8xl">
            Feito por aqui, para ficar com você.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-ink/65 lg:justify-self-end">
            Produtos e valores são demonstrativos. As categorias serão criadas e
            administradas dinamicamente em uma etapa futura.
          </p>
        </div>
      </section>

      <section className="page-shell pb-14" aria-labelledby="categorias-title">
        <h2 id="categorias-title" className="sr-only">
          Categorias
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {categories.map((category, index) => (
            <article
              key={category.slug}
              className="rounded-[1.4rem] border border-brand/12 bg-surface p-5"
            >
              <span className="text-xs font-bold text-brand">0{index + 1}</span>
              <h3 className="mt-4 font-display text-3xl text-ink">
                {category.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {category.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="catalogo" className="bg-sand/45 py-14 sm:py-20">
        <div className="page-shell">
          <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Todos os produtos</p>
              <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
                {products.length} criações demonstrativas
              </h2>
            </div>

            <form
              className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_11rem_auto]"
              aria-describedby="filter-note"
            >
              <label className="relative">
                <span className="sr-only">Pesquisar produtos</span>
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/45" />
                <input
                  type="search"
                  disabled
                  placeholder="Pesquisar"
                  className="h-12 w-full cursor-not-allowed rounded-full border border-ink/15 bg-paper pl-11 pr-4 text-sm placeholder:text-ink/40 disabled:opacity-80"
                />
              </label>
              <label>
                <span className="sr-only">Ordenar produtos</span>
                <select
                  disabled
                  defaultValue="destaques"
                  className="h-12 w-full cursor-not-allowed rounded-full border border-ink/15 bg-paper px-4 text-sm text-ink/70 disabled:opacity-80"
                >
                  <option value="destaques">Destaques</option>
                  <option value="menor-preco">Menor preço</option>
                  <option value="maior-preco">Maior preço</option>
                </select>
              </label>
              <button
                type="button"
                disabled
                className="h-12 cursor-not-allowed rounded-full bg-brand px-5 text-sm font-bold text-cream opacity-55"
              >
                Filtrar
              </button>
            </form>
          </div>
          <p id="filter-note" className="mb-7 text-xs text-ink/55">
            Busca, filtros e ordenação serão ativados quando o catálogo dinâmico
            for implementado.
          </p>
          <ProductGrid products={products} eagerFirstImage />
        </div>
      </section>
    </main>
  );
}

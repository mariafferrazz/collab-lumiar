import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CatalogModeNotice } from "@/components/catalog/catalog-mode-notice";
import { ProductGrid } from "@/components/product/product-grid";
import { categories as demoCategories } from "@/data/catalog";
import { readPublicProductSearchInput } from "@/lib/catalog/public-query";
import { publicCatalog } from "@/lib/server/catalog";
import type { PublicProductSearchInput } from "@/types/public-catalog";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return demoCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const category = await publicCatalog.categoryBySlug(slug);
  if (!category) return { title: "Categoria não encontrada" };
  return {
    title: category.name,
    description:
      category.description ?? `Produtos publicados em ${category.name}.`,
  };
}

function categoryHref(
  slug: string,
  input: PublicProductSearchInput,
  page: number,
) {
  const parameters = new URLSearchParams();
  if (input.query) parameters.set("q", input.query);
  if (input.availability !== "all") {
    parameters.set("disponibilidade", input.availability);
  }
  if (input.sort !== "newest") parameters.set("ordem", input.sort);
  if (page > 1) parameters.set("pagina", String(page));
  const query = parameters.toString();
  return query ? `/categorias/${slug}?${query}` : `/categorias/${slug}`;
}

async function CategoryContent({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, rawParameters] = await Promise.all([params, searchParams]);
  const category = await publicCatalog.categoryBySlug(slug);
  if (!category) notFound();
  const input = readPublicProductSearchInput({
    q: rawParameters.q,
    categoria: slug,
    disponibilidade: rawParameters.disponibilidade,
    ordem: rawParameters.ordem,
    pagina: rawParameters.pagina,
  });
  const [products, categories] = await Promise.all([
    publicCatalog.searchProducts(input),
    publicCatalog.categories(),
  ]);
  const source = publicCatalog.source();
  const parent = category.parentId
    ? categories.find((candidate) => candidate.id === category.parentId)
    : null;
  const children = categories.filter(
    (candidate) => candidate.parentId === category.id,
  );

  return (
    <main id="conteudo" className="page-shell py-12 sm:py-20">
      <nav aria-label="Navegação estrutural" className="text-xs text-ink/55">
        <Link className="hover:text-brand" href="/categorias">
          Categorias
        </Link>
        {parent ? (
          <>
            <span aria-hidden="true" className="px-2">
              /
            </span>
            <Link
              className="hover:text-brand"
              href={`/categorias/${parent.slug}`}
            >
              {parent.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span>{category.name}</span>
      </nav>
      <p className="eyebrow mt-8">Categoria publicada</p>
      <h1 className="mt-3 font-display text-6xl leading-[0.9] tracking-[-0.05em] text-ink sm:text-8xl">
        {category.name}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/65">
        {category.description ?? "Categoria da curadoria COLLAB."}
      </p>
      <div className="mt-8">
        <CatalogModeNotice source={source} />
      </div>

      {children.length ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {children.map((child) => (
            <Link
              className="button-secondary"
              href={`/categorias/${child.slug}`}
              key={child.id}
            >
              {child.name} · {child.productCount}
            </Link>
          ))}
        </div>
      ) : null}

      <section
        className="mt-12 border-t border-brand/15 pt-10"
        aria-labelledby="category-products"
      >
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Produtos publicados</p>
            <h2
              id="category-products"
              className="mt-2 font-display text-4xl text-ink"
            >
              {products.total} {products.total === 1 ? "criação" : "criações"}
            </h2>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-3"
            action={`/categorias/${slug}`}
          >
            <input
              className="h-11 rounded-full border border-ink/15 bg-paper px-4 text-sm"
              defaultValue={input.query}
              name="q"
              placeholder="Produto ou artista"
              type="search"
            />
            <select
              className="h-11 rounded-full border border-ink/15 bg-paper px-4 text-sm"
              defaultValue={input.availability}
              name="disponibilidade"
            >
              <option value="all">Todo o estoque</option>
              <option value="in-stock">Disponíveis</option>
              <option value="out-of-stock">Esgotados</option>
            </select>
            <select
              className="h-11 rounded-full border border-ink/15 bg-paper px-4 text-sm"
              defaultValue={input.sort}
              name="ordem"
            >
              <option value="newest">Novidades</option>
              <option value="name-asc">Nome: A–Z</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
            <button className="button-primary sm:col-span-3" type="submit">
              Aplicar filtros
            </button>
          </form>
        </div>
        {products.rows.length ? (
          <ProductGrid products={products.rows} eagerFirstImage />
        ) : (
          <p className="rounded-2xl border border-dashed border-brand/20 p-7 text-sm text-ink/60">
            Nenhum produto público corresponde aos filtros desta categoria.
          </p>
        )}
        {products.totalPages > 1 ? (
          <nav
            className="mt-10 flex items-center justify-center gap-3"
            aria-label="Paginação da categoria"
          >
            {products.page > 1 ? (
              <Link
                className="button-secondary"
                href={categoryHref(slug, input, products.page - 1)}
              >
                Anterior
              </Link>
            ) : null}
            <span className="text-sm text-ink/60">
              Página {products.page} de {products.totalPages}
            </span>
            {products.page < products.totalPages ? (
              <Link
                className="button-secondary"
                href={categoryHref(slug, input, products.page + 1)}
              >
                Próxima
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}

export default function CategoryPage(props: CategoryPageProps) {
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="page-shell py-20 text-sm text-ink/60">
          Carregando categoria…
        </main>
      }
    >
      <CategoryContent {...props} />
    </Suspense>
  );
}

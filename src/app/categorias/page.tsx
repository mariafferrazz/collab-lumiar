import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CatalogModeNotice } from "@/components/catalog/catalog-mode-notice";
import { publicCatalog } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "Categorias",
  description: "Navegue pelas categorias publicadas da COLLAB LUMIAR.",
};

async function CategoriesContent() {
  const categories = await publicCatalog.categories();
  const source = publicCatalog.source();
  const roots = categories.filter((category) => category.parentId === null);

  return (
    <main id="conteudo" className="page-shell py-12 sm:py-20">
      <p className="eyebrow">Curadoria dinâmica</p>
      <h1 className="mt-4 font-display text-6xl leading-[0.9] tracking-[-0.05em] text-ink sm:text-8xl">
        Categorias da COLLAB
      </h1>
      <div className="mt-8">
        <CatalogModeNotice source={source} />
      </div>
      {roots.length ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {roots.map((category) => {
            const children = categories.filter(
              (candidate) => candidate.parentId === category.id,
            );
            return (
              <article
                className="rounded-[1.5rem] border border-brand/12 bg-surface p-6"
                key={category.id}
              >
                <h2 className="font-display text-4xl text-ink">
                  <Link
                    className="hover:text-brand"
                    href={`/categorias/${category.slug}`}
                  >
                    {category.name}
                  </Link>
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  {category.description ?? "Categoria da curadoria COLLAB."}
                </p>
                <p className="mt-3 text-xs font-bold text-brand">
                  {category.productCount}{" "}
                  {category.productCount === 1 ? "produto" : "produtos"}
                </p>
                {children.length ? (
                  <ul className="mt-5 grid gap-2 border-t border-brand/10 pt-4">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          className="text-link text-sm"
                          href={`/categorias/${child.slug}`}
                        >
                          {child.name} · {child.productCount}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-10 rounded-2xl border border-dashed border-brand/20 p-7 text-sm text-ink/60">
          Nenhuma categoria possui produtos públicos neste catálogo.
        </p>
      )}
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="page-shell py-20 text-sm text-ink/60">
          Carregando categorias…
        </main>
      }
    >
      <CategoriesContent />
    </Suspense>
  );
}

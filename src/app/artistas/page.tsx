import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ArtistCard } from "@/components/artist/artist-card";
import { CatalogModeNotice } from "@/components/catalog/catalog-mode-notice";
import { SearchIcon } from "@/components/ui/icons";
import { readPublicArtistSearchInput } from "@/lib/catalog/public-query";
import { publicCatalog } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "Artistas",
  description:
    "Conheça artistas e produtores ativos da curadoria COLLAB LUMIAR.",
};

async function ArtistsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const input = readPublicArtistSearchInput({
    q: parameters.q,
    pagina: parameters.pagina,
  });
  const result = await publicCatalog.searchArtists(input);
  const source = publicCatalog.source();

  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (input.query) query.set("q", input.query);
    if (page > 1) query.set("pagina", String(page));
    return query.size ? `/artistas?${query}` : "/artistas";
  };

  return (
    <main id="conteudo" className="page-shell py-12 sm:py-20">
      <section className="grid gap-8 border-b border-brand/20 pb-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="eyebrow">Pessoas & processos</p>
          <h1 className="mt-4 max-w-4xl font-display text-6xl leading-[0.87] tracking-[-0.055em] text-ink sm:text-8xl">
            A arte começa em quem faz.
          </h1>
        </div>
        <p className="max-w-lg text-lg leading-8 text-ink/65 lg:justify-self-end">
          Biografias, processos e produtos dos artistas ativos da curadoria.
          Contatos privados nunca são publicados.
        </p>
      </section>

      <section className="py-10" aria-labelledby="lista-artistas">
        <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <CatalogModeNotice source={source} />
          <form action="/artistas" className="relative min-w-72">
            <label>
              <span className="sr-only">Pesquisar artistas</span>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/45" />
              <input
                className="h-12 w-full rounded-full border border-ink/15 bg-paper pl-11 pr-24 text-sm"
                defaultValue={input.query}
                name="q"
                placeholder="Nome do artista"
                type="search"
              />
            </label>
            <button
              className="absolute right-1 top-1 h-10 rounded-full bg-brand px-4 text-xs font-bold text-cream"
              type="submit"
            >
              Buscar
            </button>
          </form>
        </div>
        <h2 id="lista-artistas" className="sr-only">
          Lista de artistas
        </h2>
        {result.rows.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {result.rows.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-brand/20 bg-surface p-8 text-center">
            <h3 className="font-display text-3xl text-ink">
              Nenhum artista encontrado
            </h3>
            <p className="mt-2 text-sm text-ink/60">
              Ajuste a busca ou aguarde a ativação de novos perfis.
            </p>
          </div>
        )}
        {result.totalPages > 1 ? (
          <nav
            className="mt-10 flex items-center justify-center gap-3"
            aria-label="Paginação de artistas"
          >
            {result.page > 1 ? (
              <Link
                className="button-secondary"
                href={pageHref(result.page - 1)}
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
                href={pageHref(result.page + 1)}
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

export default function ArtistsPage({ searchParams }: PageProps<"/artistas">) {
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="page-shell py-20 text-sm text-ink/60">
          Carregando artistas…
        </main>
      }
    >
      <ArtistsContent searchParams={searchParams} />
    </Suspense>
  );
}

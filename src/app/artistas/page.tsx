import type { Metadata } from "next";

import { ArtistCard } from "@/components/artist/artist-card";
import { artists } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Artistas",
  description:
    "Conheça perfis demonstrativos de artistas e produtores da região de Lumiar e Nova Friburgo.",
};

export default function ArtistsPage() {
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
          Perfis demonstrativos para apresentar o futuro espaço de biografias,
          processos, redes sociais e produtos de cada artista.
        </p>
      </section>

      <section className="py-12 sm:py-16" aria-labelledby="lista-artistas">
        <h2 id="lista-artistas" className="sr-only">
          Lista de artistas
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.slug} artist={artist} />
          ))}
        </div>
      </section>

      <aside className="rounded-[1.6rem] border border-brand/12 bg-surface p-6 text-sm leading-7 text-ink/65 sm:p-8">
        <strong className="text-ink">Transparência da demonstração:</strong> os
        nomes, textos e retratos acima são fictícios e servem apenas para
        validar o design desta etapa. Os perfis reais serão cadastrados com
        consentimento em uma etapa futura.
      </aside>
    </main>
  );
}

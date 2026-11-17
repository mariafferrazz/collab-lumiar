import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { ArtistCard } from "@/components/artist/artist-card";
import {
  InstagramPreview,
  InstagramPreviewLoading,
} from "@/components/instagram-preview";
import { ProductGrid } from "@/components/product/product-grid";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { artists, products } from "@/data/catalog";

export default function Home() {
  const featuredProducts = products
    .filter((product) => product.featured)
    .slice(0, 4);
  const featuredArtists = artists.filter((artist) => artist.featured);

  return (
    <main id="conteudo">
      <section className="page-shell pt-4 sm:pt-6" aria-labelledby="hero-title">
        <div className="grid overflow-hidden rounded-[2rem] border border-brand/15 bg-surface lg:grid-cols-[0.92fr_1.08fr]">
          <div className="flex flex-col justify-center px-6 py-12 sm:px-12 sm:py-16 lg:min-h-[42rem] lg:px-16">
            <p className="eyebrow flex items-center gap-2">
              <span aria-hidden="true" className="text-base leading-none">
                ✦
              </span>
              Arte autoral · Região serrana do Rio
            </p>
            <h1
              id="hero-title"
              className="mt-6 max-w-xl font-display text-[clamp(3.6rem,7vw,6.6rem)] font-medium leading-[0.84] tracking-[-0.055em] text-ink"
            >
              Arte local, feita{" "}
              <span className="italic text-brand">em colaboração.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-ink/70 sm:text-xl">
              Objetos com história, feitos em colaboração com artistas e
              produtores de Lumiar e Nova Friburgo.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="button-primary" href="/produtos">
                Conhecer produtos
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link className="button-secondary" href="/artistas">
                Encontrar artistas
              </Link>
            </div>
            <p className="mt-8 text-xs text-ink/50">
              Imagens, nomes e produtos demonstrativos da Etapa 1.1.
            </p>
          </div>

          <div className="relative min-h-[28rem] border-t border-brand/10 lg:min-h-[42rem] lg:border-l lg:border-t-0">
            <Image
              src="/images/hero-serra.webp"
              alt="Ateliê com cerâmicas, tecidos e gravuras diante das montanhas de Nova Friburgo"
              fill
              preload
              sizes="(max-width: 1024px) 96vw, 54vw"
              className="object-cover object-[64%_center]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand/70 to-transparent p-6 pt-24 text-right text-xs font-bold uppercase tracking-[0.14em] text-cream">
              Curadoria demonstrativa · Etapa 1.1
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell grid gap-10 py-20 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="eyebrow">Nossa história</p>
          <h2 className="mt-4 font-display text-5xl leading-[0.94] tracking-[-0.04em] text-ink sm:text-6xl">
            Quando o território vira encontro.
          </h2>
        </div>
        <div className="border-l-2 border-brand pl-6 sm:pl-10">
          <p className="text-xl leading-9 text-ink/80 sm:text-2xl sm:leading-10">
            A COLLAB nasce para aproximar quem cria e quem escolhe viver com
            objetos cheios de presença. Cada coleção é uma conversa entre
            técnicas, paisagens e trajetórias da serra.
          </p>
          <p className="mt-6 text-base leading-7 text-ink/60">
            Este texto institucional é demonstrativo e poderá ser atualizado
            futuramente pelo painel administrativo.
          </p>
          <Link className="text-link mt-7" href="/sobre">
            Conheça a proposta
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </section>

      <section
        className="bg-surface/70 py-16 sm:py-24"
        aria-labelledby="produtos-title"
      >
        <div className="page-shell">
          <div id="produtos-title">
            <SectionHeading
              eyebrow="Seleção da serra"
              title="Produtos em destaque"
              description="Pequenas séries, materiais honestos e processos que deixam a mão de quem fez aparecer."
              href="/produtos"
              linkLabel="Ver todo o catálogo"
            />
          </div>
          <ProductGrid products={featuredProducts} />
          <p className="mt-8 text-xs leading-5 text-ink/55">
            Carrinho e favoritos são apenas elementos visuais nesta etapa.
          </p>
        </div>
      </section>

      <section
        className="page-shell py-20 sm:py-28"
        aria-labelledby="artistas-title"
      >
        <div id="artistas-title">
          <SectionHeading
            eyebrow="Quem faz"
            title="Artistas em destaque"
            description="Quatro perfis fictícios apresentam como a futura área de artistas poderá valorizar processos, biografias e produtos."
            href="/artistas"
            linkLabel="Conhecer todos"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredArtists.map((artist) => (
            <ArtistCard key={artist.slug} artist={artist} />
          ))}
        </div>
      </section>

      <Suspense fallback={<InstagramPreviewLoading />}>
        <InstagramPreview />
      </Suspense>
    </main>
  );
}

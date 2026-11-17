import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductGrid } from "@/components/product/product-grid";
import { ArrowRightIcon, InstagramIcon } from "@/components/ui/icons";
import { artists, getArtistBySlug, getProductsByArtist } from "@/data/catalog";

type ArtistPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return artists.map((artist) => ({ slug: artist.slug }));
}

export async function generateMetadata({
  params,
}: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) {
    return { title: "Artista não encontrado" };
  }

  return {
    title: artist.name,
    description: artist.introduction,
  };
}

export default function ArtistProfilePage({ params }: ArtistPageProps) {
  return (
    <Suspense fallback={<ArtistProfileFallback />}>
      <ArtistProfileContent params={params} />
    </Suspense>
  );
}

function ArtistProfileFallback() {
  return (
    <main id="conteudo">
      <div
        className="page-shell flex min-h-[32rem] items-center justify-center py-16 text-sm text-ink/60"
        role="status"
      >
        Preparando perfil do artista…
      </div>
    </main>
  );
}

async function ArtistProfileContent({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) {
    notFound();
  }

  const artistProducts = getProductsByArtist(artist.slug);

  return (
    <main id="conteudo">
      <div className="page-shell py-10 sm:py-16">
        <nav aria-label="Navegação estrutural" className="text-xs text-ink/55">
          <Link className="hover:text-brand" href="/artistas">
            Artistas
          </Link>
          <span aria-hidden="true" className="px-2">
            /
          </span>
          <span>{artist.name}</span>
        </nav>

        <section className="mt-7 grid overflow-hidden rounded-[2rem] border border-brand/12 bg-surface lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[32rem] lg:min-h-[45rem]">
            <Image
              src={artist.image.src}
              alt={artist.image.alt}
              fill
              loading="eager"
              sizes="(max-width: 1024px) 92vw, 44vw"
              className="object-cover"
              style={{ objectPosition: artist.image.position }}
            />
            <span className="absolute bottom-4 left-4 rounded-full bg-brand px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-cream">
              Perfil demonstrativo
            </span>
          </div>

          <div className="flex flex-col justify-center p-7 sm:p-12 lg:p-16">
            <p className="eyebrow">{artist.discipline}</p>
            <h1 className="mt-4 font-display text-6xl leading-[0.87] tracking-[-0.055em] text-ink sm:text-8xl">
              {artist.name}
            </h1>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-ink/50">
              {artist.location}
            </p>
            <p className="mt-8 text-xl leading-9 text-ink/75">
              {artist.introduction}
            </p>
            <p className="mt-6 text-base leading-8 text-ink/65">
              {artist.biography}
            </p>
            <div className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-xs font-bold text-ink/60">
              <InstagramIcon className="size-4" />
              {artist.socialLabel}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-labelledby="artist-products">
          <div className="mb-9 flex flex-col justify-between gap-4 border-b border-ink/15 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Criações relacionadas</p>
              <h2
                id="artist-products"
                className="mt-3 font-display text-4xl text-ink sm:text-5xl"
              >
                Produtos de {artist.name}
              </h2>
            </div>
            <Link className="text-link" href="/produtos">
              Ver catálogo completo
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <ProductGrid products={artistProducts} />
        </section>
      </div>
    </main>
  );
}

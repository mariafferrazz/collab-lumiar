import Link from "next/link";

import { CatalogImage } from "@/components/catalog/catalog-image";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { PublicArtist } from "@/types/public-catalog";

export function ArtistCard({ artist }: { artist: PublicArtist }) {
  return (
    <article className="group overflow-hidden rounded-[1.6rem] border border-brand/12 bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_18px_45px_rgba(137,14,25,0.08)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        <CatalogImage
          image={artist.image}
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-[1.025]"
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-brand px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-cream">
          {artist.id.startsWith("demo-")
            ? "Perfil demonstrativo"
            : "Artista ativo"}
        </span>
      </div>
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-brand">
          {artist.productCount}{" "}
          {artist.productCount === 1 ? "produto" : "produtos"}
        </p>
        <h3 className="mt-2 font-display text-3xl leading-none text-ink">
          {artist.name}
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          {artist.biography.length > 145
            ? `${artist.biography.slice(0, 142).trimEnd()}…`
            : artist.biography}
        </p>
        <Link
          className="text-link mt-5"
          href={`/artistas/${artist.pathSegment}`}
        >
          Conhecer o perfil
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </article>
  );
}

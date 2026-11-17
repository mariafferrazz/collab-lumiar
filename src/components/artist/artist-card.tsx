import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/icons";
import type { Artist } from "@/types/catalog";

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <article className="group overflow-hidden rounded-[1.6rem] border border-brand/12 bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_18px_45px_rgba(137,14,25,0.08)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        <Image
          src={artist.image.src}
          alt={artist.image.alt}
          fill
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-[1.025]"
          style={{ objectPosition: artist.image.position }}
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-brand px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-cream">
          Perfil demonstrativo
        </span>
      </div>
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-brand">
          {artist.discipline}
        </p>
        <h3 className="mt-2 font-display text-3xl leading-none text-ink">
          {artist.name}
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          {artist.introduction}
        </p>
        <Link className="text-link mt-5" href={`/artistas/${artist.slug}`}>
          Conhecer o perfil
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </article>
  );
}

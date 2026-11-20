import Image from "next/image";

import type { PublicCatalogImage } from "@/types/public-catalog";

type CatalogImageProps = {
  image: PublicCatalogImage;
  sizes: string;
  eager?: boolean;
  className?: string;
};

export function CatalogImage({
  image,
  sizes,
  eager = false,
  className = "object-cover",
}: CatalogImageProps) {
  if (image.src) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        loading={eager ? "eager" : "lazy"}
        sizes={sizes}
        className={className}
        style={image.position ? { objectPosition: image.position } : undefined}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,#f4e8d5,#e7d3b6)] p-6 text-center text-brand/70"
      role="img"
      aria-label={image.alt}
    >
      <span>
        <span className="block font-display text-5xl" aria-hidden="true">
          ✦
        </span>
        <span className="mt-3 block text-xs font-bold uppercase tracking-[0.13em]">
          Imagem ainda não disponível
        </span>
      </span>
    </div>
  );
}

import Link from "next/link";

import { CatalogImage } from "@/components/catalog/catalog-image";
import { CartIcon, HeartIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import type { PublicProductSummary } from "@/types/public-catalog";

type ProductCardProps = {
  product: PublicProductSummary;
  eager?: boolean;
};

export function ProductCard({ product, eager = false }: ProductCardProps) {
  const category = product.categories[0];

  return (
    <article className="product-card group rounded-[1.5rem] border border-brand/10 bg-surface p-2 pb-5">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.05rem] bg-sand">
        <Link className="absolute inset-0" href={`/produtos/${product.slug}`}>
          <CatalogImage
            image={product.image}
            eager={eager}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        </Link>
        <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-brand backdrop-blur">
          {category?.name ?? "COLLAB"}
        </span>
        <button
          type="button"
          disabled
          title="Favoritos disponíveis em uma etapa futura"
          className="absolute right-3 top-3 grid size-10 cursor-not-allowed place-items-center rounded-full bg-surface/90 text-brand/50 backdrop-blur"
          aria-label={`Salvar ${product.name} nos favoritos — indisponível nesta etapa`}
        >
          <HeartIcon className="size-[1.1rem]" />
        </button>
      </div>

      <div className="px-2 pt-4">
        <Link
          className="text-xs font-bold uppercase tracking-[0.13em] text-brand hover:underline"
          href={`/artistas/${product.artist.pathSegment}`}
        >
          {product.artist.name}
        </Link>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl leading-tight text-ink">
              <Link
                className="hover:text-brand"
                href={`/produtos/${product.slug}`}
              >
                {product.name}
              </Link>
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              {product.shortDescription}
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Carrinho disponível em uma etapa futura"
            className="grid size-10 shrink-0 cursor-not-allowed place-items-center rounded-full border border-brand/20 text-brand/45"
            aria-label={`Adicionar ${product.name} ao carrinho — indisponível nesta etapa`}
          >
            <CartIcon className="size-[1.05rem]" />
          </button>
        </div>
        <p className="mt-3 text-base font-bold text-brand">
          {formatPrice(product.priceInCents)}
        </p>
        <p className="mt-1 text-xs text-ink/50">
          {product.source === "demo"
            ? "Disponibilidade demonstrativa"
            : (product.availableQuantity ?? 0) > 0
              ? `${product.availableQuantity} em estoque local`
              : "Esgotado"}
        </p>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductGrid } from "@/components/product/product-grid";
import { HeartIcon } from "@/components/ui/icons";
import { getArtistBySlug, getProductBySlug, products } from "@/data/catalog";
import { formatPrice } from "@/lib/format";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return { title: "Produto não encontrado" };
  }

  return {
    title: product.name,
    description: product.shortDescription,
  };
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  return (
    <Suspense fallback={<ProductDetailFallback />}>
      <ProductDetailContent params={params} />
    </Suspense>
  );
}

function ProductDetailFallback() {
  return (
    <main id="conteudo">
      <div
        className="page-shell flex min-h-[32rem] items-center justify-center py-16 text-sm text-ink/60"
        role="status"
      >
        Preparando detalhes do produto…
      </div>
    </main>
  );
}

async function ProductDetailContent({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const artist = getArtistBySlug(product.artistSlug);
  const relatedProducts = products
    .filter(
      (candidate) =>
        candidate.artistSlug === product.artistSlug &&
        candidate.slug !== product.slug,
    )
    .slice(0, 3);

  return (
    <main id="conteudo">
      <div className="page-shell py-10 sm:py-16">
        <nav aria-label="Navegação estrutural" className="text-xs text-ink/55">
          <Link className="hover:text-brand" href="/produtos">
            Produtos
          </Link>
          <span aria-hidden="true" className="px-2">
            /
          </span>
          <span>{product.name}</span>
        </nav>

        <div className="mt-7 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <section
            aria-label="Galeria do produto"
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.6rem] bg-sand sm:row-span-2">
              <Image
                src={product.gallery[0].src}
                alt={product.gallery[0].alt}
                fill
                loading="eager"
                sizes="(max-width: 1024px) 92vw, 40vw"
                className="object-cover"
              />
            </div>
            {product.gallery.slice(1).map((image) => (
              <div
                key={image.src}
                className="relative aspect-square overflow-hidden rounded-[1.6rem] bg-sand"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 20vw"
                  className="object-cover"
                />
              </div>
            ))}
          </section>

          <section
            aria-labelledby="product-title"
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <p className="eyebrow">Peça autoral · conteúdo demonstrativo</p>
            <h1
              id="product-title"
              className="mt-4 font-display text-5xl leading-[0.94] tracking-[-0.045em] text-ink sm:text-6xl"
            >
              {product.name}
            </h1>
            {artist ? (
              <Link
                className="mt-4 inline-block text-sm font-bold text-brand hover:underline"
                href={`/artistas/${artist.slug}`}
              >
                por {artist.name} · {artist.discipline}
              </Link>
            ) : null}
            <p className="mt-7 text-2xl font-bold text-ink">
              {formatPrice(product.priceInCents)}
            </p>
            <p className="mt-6 text-base leading-8 text-ink/70">
              {product.description}
            </p>

            <div className="mt-8 grid gap-5 border-y border-ink/15 py-7 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Variação
                <select
                  disabled
                  className="h-12 cursor-not-allowed rounded-xl border border-ink/15 bg-paper px-3 font-normal text-ink/65 opacity-80"
                >
                  {product.variations.map((variation) => (
                    <option key={variation}>{variation}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Quantidade
                <input
                  type="number"
                  min="1"
                  defaultValue="1"
                  disabled
                  className="h-12 cursor-not-allowed rounded-xl border border-ink/15 bg-paper px-3 font-normal text-ink/65 opacity-80"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                disabled
                className="button-primary cursor-not-allowed opacity-55"
              >
                Adicionar ao carrinho · em breve
              </button>
              <button
                type="button"
                disabled
                className="button-secondary cursor-not-allowed opacity-55"
              >
                <HeartIcon className="size-4" />
                Salvar
              </button>
            </div>

            <div className="mt-8 rounded-2xl bg-sand/60 p-5">
              <h2 className="font-bold text-ink">Calcular frete</h2>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  disabled
                  placeholder="CEP"
                  aria-label="CEP — cálculo indisponível nesta etapa"
                  className="h-11 min-w-0 flex-1 cursor-not-allowed rounded-full border border-ink/15 bg-paper px-4 text-sm opacity-75"
                />
                <button
                  type="button"
                  disabled
                  className="h-11 cursor-not-allowed rounded-full bg-brand px-4 text-sm font-bold text-cream opacity-55"
                >
                  Calcular
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink/55">
                Integração de frete não implementada nesta etapa.
              </p>
            </div>
          </section>
        </div>

        <section className="mt-16 grid gap-8 border-t border-ink/15 pt-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Detalhes da peça</p>
            <h2 className="mt-3 font-display text-4xl text-ink">
              Materiais & características
            </h2>
            <ul className="mt-6 grid gap-3 text-sm text-ink/70">
              {product.materials.map((material) => (
                <li
                  key={material}
                  className="flex gap-3 border-b border-ink/10 pb-3"
                >
                  <span aria-hidden="true" className="text-brand">
                    ●
                  </span>
                  {material}
                </li>
              ))}
              <li className="flex gap-3 border-b border-ink/10 pb-3">
                <span aria-hidden="true" className="text-brand">
                  ●
                </span>
                {product.dimensions}
              </li>
            </ul>
          </div>
          <div className="rounded-[1.6rem] border border-ink/10 p-6">
            <p className="eyebrow">Avaliações</p>
            <h2 className="mt-3 font-display text-4xl text-ink">
              Opiniões de quem escolheu
            </h2>
            <p className="mt-5 text-sm leading-7 text-ink/60">
              As avaliações serão exibidas aqui quando a compra e a moderação de
              conteúdo forem implementadas. Nenhuma avaliação fictícia é
              apresentada como real.
            </p>
          </div>
        </section>

        {relatedProducts.length > 0 ? (
          <section className="mt-20 border-t border-ink/15 pt-12">
            <p className="eyebrow">Do mesmo ateliê</p>
            <h2 className="mb-8 mt-3 font-display text-4xl text-ink">
              Outras criações de {artist?.name}
            </h2>
            <ProductGrid products={relatedProducts} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

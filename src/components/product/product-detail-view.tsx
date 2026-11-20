import Link from "next/link";

import { CatalogImage } from "@/components/catalog/catalog-image";
import { ProductGrid } from "@/components/product/product-grid";
import { HeartIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import type {
  AdminProductPreview,
  PublicProductDetail,
  PublicProductSummary,
} from "@/types/public-catalog";

type ProductDetailViewProps = {
  product: PublicProductDetail | AdminProductPreview;
  relatedProducts?: PublicProductSummary[];
  preview?: boolean;
};

function readableCharacteristic(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return null;
}

export function ProductDetailView({
  product,
  relatedProducts = [],
  preview = false,
}: ProductDetailViewProps) {
  const images = product.images.length ? product.images : [product.image];
  const characteristics = Object.entries(product.characteristics)
    .map(([label, value]) => [label, readableCharacteristic(value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);
  const isDemo = product.source === "demo";
  const availableQuantity = product.availableQuantity ?? 0;
  const previewProduct = preview ? (product as AdminProductPreview) : null;

  return (
    <main id="conteudo">
      <div className="page-shell py-10 sm:py-16">
        {previewProduct ? (
          <section className="mb-7 rounded-2xl border-2 border-brand bg-brand/5 p-5">
            <p className="eyebrow">Prévia administrativa privada</p>
            <h1 className="mt-2 font-display text-3xl text-ink">
              Esta página não é a vitrine pública
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Conteúdo somente leitura, protegido por sessão ADMIN e excluído de
              indexação e cache público. Status atual:{" "}
              {previewProduct.publicationStatus}.
            </p>
            {previewProduct.publicationBlockers.length ? (
              <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-4">
                <strong className="text-sm text-error">
                  Pendências que bloqueiam a publicação
                </strong>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
                  {previewProduct.publicationBlockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold text-success">
                Os requisitos técnicos de publicação estão completos.
              </p>
            )}
          </section>
        ) : null}

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
            {images.map((image, index) => (
              <div
                key={`${image.src ?? "imagem-persistida"}-${image.alt}`}
                className={`relative overflow-hidden rounded-[1.6rem] bg-sand ${
                  index === 0 ? "aspect-[4/5] sm:row-span-2" : "aspect-square"
                }`}
              >
                <CatalogImage
                  image={image}
                  eager={index === 0}
                  sizes={
                    index === 0
                      ? "(max-width: 1024px) 92vw, 40vw"
                      : "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 20vw"
                  }
                />
              </div>
            ))}
          </section>

          <section
            aria-labelledby="product-title"
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <p className="eyebrow">
              {preview
                ? "Prévia administrativa"
                : isDemo
                  ? "Peça autoral · conteúdo demonstrativo"
                  : "Peça autoral · catálogo local"}
            </p>
            <h1
              id="product-title"
              className="mt-4 font-display text-5xl leading-[0.94] tracking-[-0.045em] text-ink sm:text-6xl"
            >
              {product.name}
            </h1>
            <Link
              className="mt-4 inline-block text-sm font-bold text-brand hover:underline"
              href={`/artistas/${product.artist.pathSegment}`}
            >
              por {product.artist.name}
            </Link>
            <p className="mt-7 text-2xl font-bold text-ink">
              {product.priceInCents === null
                ? "Preço pendente de validação"
                : formatPrice(product.priceInCents)}
            </p>
            <p className="mt-3 text-sm font-bold text-brand">
              {isDemo
                ? "Disponibilidade apenas demonstrativa"
                : availableQuantity > 0
                  ? `Disponível · ${availableQuantity} em estoque local`
                  : "Esgotado"}
            </p>
            <p className="mt-6 text-base leading-8 text-ink/70">
              {product.description || "Descrição ainda não preenchida."}
            </p>

            {product.categories.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {product.categories.map((category) => (
                  <Link
                    className="rounded-full border border-brand/15 px-3 py-1 text-xs font-bold text-brand hover:bg-brand hover:text-cream"
                    href={`/categorias/${category.slug}`}
                    key={category.id}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 border-y border-ink/15 py-7 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Variação
                <select
                  disabled
                  className="h-12 cursor-not-allowed rounded-xl border border-ink/15 bg-paper px-3 font-normal text-ink/65 opacity-80"
                >
                  {product.variations.length ? (
                    product.variations.map((variation) => (
                      <option key={variation.id}>
                        {variation.label}
                        {!isDemo ? ` · ${variation.availableQuantity} un.` : ""}
                      </option>
                    ))
                  ) : (
                    <option>Nenhuma variação disponível</option>
                  )}
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

            {!preview ? (
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
            ) : null}

            <div className="mt-8 rounded-2xl bg-sand/60 p-5">
              <h2 className="font-bold text-ink">Frete separado</h2>
              <p className="mt-2 text-xs leading-5 text-ink/55">
                {product.logistics
                  ? `Embalagem cadastrada: ${product.logistics.packageWeightGrams} g, ${product.logistics.packageHeightCm} × ${product.logistics.packageWidthCm} × ${product.logistics.packageLengthCm} cm.`
                  : "Perfil logístico ainda não disponível. Nenhuma cotação é realizada nesta etapa."}
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
              {[product.material, product.productionTechnique]
                .filter(Boolean)
                .map((value) => (
                  <li
                    key={value}
                    className="flex gap-3 border-b border-ink/10 pb-3"
                  >
                    <span aria-hidden="true" className="text-brand">
                      ●
                    </span>
                    {value}
                  </li>
                ))}
              {characteristics.map(([label, value]) => (
                <li
                  key={label}
                  className="flex gap-3 border-b border-ink/10 pb-3"
                >
                  <span aria-hidden="true" className="text-brand">
                    ●
                  </span>
                  <span>
                    <strong>{label}:</strong> {value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[1.6rem] border border-ink/10 p-6">
            <p className="eyebrow">Transparência</p>
            <h2 className="mt-3 font-display text-4xl text-ink">
              Informações da vitrine
            </h2>
            <p className="mt-5 text-sm leading-7 text-ink/60">
              O preço exibido é somente o valor final validado da mercadoria.
              Custos, participações comerciais, taxas, tributos e auditoria
              permanecem restritos ao servidor e ao painel autorizado.
            </p>
          </div>
        </section>

        {relatedProducts.length > 0 && !preview ? (
          <section className="mt-20 border-t border-ink/15 pt-12">
            <p className="eyebrow">Do mesmo ateliê</p>
            <h2 className="mb-8 mt-3 font-display text-4xl text-ink">
              Outras criações de {product.artist.name}
            </h2>
            <ProductGrid products={relatedProducts} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

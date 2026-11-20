import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductDetailView } from "@/components/product/product-detail-view";
import { products as demoProducts } from "@/data/catalog";
import { publicCatalog } from "@/lib/server/catalog";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return demoProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await publicCatalog.productBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };
  return { title: product.name, description: product.shortDescription };
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
  const product = await publicCatalog.productBySlug(slug);
  if (!product) notFound();

  const related = await publicCatalog.searchProducts({
    query: "",
    category: null,
    artist: product.artist.id,
    availability: "all",
    sort: "newest",
    page: 1,
    pageSize: 4,
  });
  const relatedProducts = related.rows
    .filter((candidate) => candidate.slug !== product.slug)
    .slice(0, 3);

  return (
    <ProductDetailView product={product} relatedProducts={relatedProducts} />
  );
}

import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/catalog";

type ProductGridProps = {
  products: Product[];
  eagerFirstImage?: boolean;
};

export function ProductGrid({
  products,
  eagerFirstImage = false,
}: ProductGridProps) {
  return (
    <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          eager={eagerFirstImage && index === 0}
        />
      ))}
    </div>
  );
}

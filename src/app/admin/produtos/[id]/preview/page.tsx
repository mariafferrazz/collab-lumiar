import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ProductDetailView } from "@/components/product/product-detail-view";
import { isUuid } from "@/lib/admin/validation";
import { requireAdminSession } from "@/lib/server/auth-session";
import { adminCatalogPreview } from "@/lib/server/catalog";

export const instant = false;

export const metadata: Metadata = {
  title: "Prévia privada do produto — Administração",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProductPreviewPage({
  params,
}: PageProps<"/admin/produtos/[id]/preview">) {
  await connection();
  await requireAdminSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const product = await adminCatalogPreview.byId(id);
  if (!product) notFound();

  return (
    <div className="grid gap-5">
      <div>
        <Link className="text-link" href={`/admin/produtos/${id}`}>
          ← Voltar aos detalhes administrativos
        </Link>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-brand/15 bg-background">
        <ProductDetailView product={product} preview />
      </div>
    </div>
  );
}

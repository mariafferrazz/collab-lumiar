import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateProductAction } from "@/app/admin/actions";
import { AdminBreadcrumbs, AdminPageHeader } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";
import { isUuid } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";
import { financialService } from "@/lib/server/financial/service";

export const metadata: Metadata = { title: "Editar produto — Administração" };

export default async function EditProductPage({
  params,
}: PageProps<"/admin/produtos/[id]/editar">) {
  await requireAdminSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [detail, artists, categories, policies, financialPricing] =
    await Promise.all([
      adminCatalog.product(id),
      adminCatalog.artistOptions(),
      adminCatalog.categoryOptions(),
      financialService.policies(),
      financialService.productPricing(id),
    ]);
  if (!detail) notFound();
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Produtos", href: "/admin/produtos" },
          { label: detail.product.name, href: `/admin/produtos/${id}` },
          { label: "Editar" },
        ]}
      />
      <AdminPageHeader
        description={
          detail.product.publicationStatus === "published"
            ? "Salvar alterações move o produto para rascunho; publique novamente após revisar todas as dependências."
            : "Atualize os dados básicos e preserve as regras de integridade do catálogo."
        }
        eyebrow="Produtos"
        title="Editar produto"
      />
      <ProductForm
        action={updateProductAction}
        artists={artists}
        categories={categories}
        policies={policies.filter((policy) => policy.status === "approved")}
        values={{
          ...detail.product,
          categoryIds: detail.categories.map((category) => category.id),
          artistCostInCents: financialPricing.find(
            (item) => item.cost.productId === id,
          )?.cost.artistCostInCents,
          policyId: financialPricing.find((item) => item.cost.productId === id)
            ?.cost.policyId,
        }}
      />
    </div>
  );
}

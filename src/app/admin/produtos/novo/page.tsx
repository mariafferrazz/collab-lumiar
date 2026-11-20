import type { Metadata } from "next";

import { createProductAction } from "@/app/admin/actions";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminPageHeader,
} from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";
import { financialService } from "@/lib/server/financial/service";

export const metadata: Metadata = { title: "Novo produto — Administração" };

export default async function NewProductPage() {
  await requireAdminSession();
  const [artists, categories, policies] = await Promise.all([
    adminCatalog.artistOptions(),
    adminCatalog.categoryOptions(),
    financialService.policies(),
  ]);
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Produtos", href: "/admin/produtos" },
          { label: "Novo" },
        ]}
      />
      <AdminPageHeader
        description="Comece pelas informações básicas. Variações, imagens e logística são adicionadas depois que o rascunho existe."
        eyebrow="Produtos"
        title="Novo rascunho"
      />
      {artists.length === 0 ? (
        <AdminEmptyState
          description="Cadastre ao menos um artista antes de criar um produto."
          title="Artista obrigatório"
        />
      ) : (
        <ProductForm
          action={createProductAction}
          artists={artists}
          categories={categories}
          policies={policies.filter((policy) => policy.status === "approved")}
        />
      )}
    </div>
  );
}

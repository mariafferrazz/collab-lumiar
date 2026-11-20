import type { Metadata } from "next";

import { createCategoryAction } from "@/app/admin/actions";
import { AdminBreadcrumbs, AdminPageHeader } from "@/components/admin/admin-ui";
import { CategoryForm } from "@/components/admin/category-form";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Nova categoria — Administração" };

export default async function NewCategoryPage() {
  await requireAdminSession();
  const categories = await adminCatalog.categoryOptions();
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Categorias", href: "/admin/categorias" },
          { label: "Nova" },
        ]}
      />
      <AdminPageHeader
        description="Crie uma categoria principal ou vincule-a a uma categoria existente."
        eyebrow="Categorias"
        title="Nova categoria"
      />
      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-8">
        <CategoryForm action={createCategoryAction} categories={categories} />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateCategoryAction } from "@/app/admin/actions";
import { AdminBreadcrumbs, AdminPageHeader } from "@/components/admin/admin-ui";
import { CategoryForm } from "@/components/admin/category-form";
import { isUuid } from "@/lib/admin/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";

export const metadata: Metadata = { title: "Editar categoria — Administração" };

export default async function EditCategoryPage({
  params,
}: PageProps<"/admin/categorias/[id]/editar">) {
  await requireAdminSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [category, options] = await Promise.all([
    adminCatalog.category(id),
    adminCatalog.categoryOptions(id),
  ]);
  if (!category) notFound();
  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Categorias", href: "/admin/categorias" },
          { label: category.name },
        ]}
      />
      <AdminPageHeader
        description="A hierarquia é validada novamente pelo PostgreSQL para impedir ciclos diretos e indiretos."
        eyebrow="Categorias"
        title="Editar categoria"
      />
      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-8">
        <CategoryForm
          action={updateCategoryAction}
          categories={options}
          values={category}
        />
      </section>
    </div>
  );
}

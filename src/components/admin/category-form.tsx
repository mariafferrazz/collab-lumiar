"use client";

import {
  AdminActionForm,
  AdminSelectField,
  AdminTextareaField,
  AdminTextField,
} from "@/components/admin/admin-form";
import type { AdminActionState } from "@/lib/admin/types";

type FormAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export function CategoryForm({
  action,
  categories,
  values,
}: {
  action: FormAction;
  categories: { id: string; name: string }[];
  values?: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
    displayOrder?: number;
  };
}) {
  return (
    <AdminActionForm
      action={action}
      submitLabel={values?.id ? "Salvar categoria" : "Criar categoria"}
    >
      {values?.id ? <input name="id" type="hidden" value={values.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <AdminTextField
          defaultValue={values?.name}
          label="Nome *"
          maxLength={120}
          name="name"
          required
        />
        <AdminTextField
          defaultValue={values?.slug}
          hint="Se ficar vazio, será derivado do nome."
          label="Slug"
          maxLength={160}
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        />
      </div>
      <AdminTextareaField
        defaultValue={values?.description}
        label="Descrição pública"
        name="description"
        rows={4}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <AdminSelectField
          defaultValue={values?.parentId ?? ""}
          label="Categoria principal"
          name="parentId"
        >
          <option value="">Nenhuma — categoria principal</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </AdminSelectField>
        <AdminTextField
          defaultValue={values?.displayOrder ?? 0}
          label="Ordem de exibição *"
          min={0}
          name="displayOrder"
          required
          type="number"
        />
      </div>
      <p className="rounded-xl border border-brand/15 bg-brand/5 p-4 text-xs leading-5 text-muted">
        O schema atual não possui status ativo para categorias. Exclusões só são
        permitidas quando não há produtos ou subcategorias vinculados.
      </p>
    </AdminActionForm>
  );
}

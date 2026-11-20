"use client";

import {
  AdminActionForm,
  AdminCheckboxField,
  AdminTextareaField,
  AdminTextField,
} from "@/components/admin/admin-form";
import type { AdminActionState } from "@/lib/admin/types";

type FormAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export interface ArtistFormValues {
  id?: string;
  artisticName?: string;
  biography?: string;
  photoPath?: string | null;
  instagramHandle?: string | null;
  isActive?: boolean;
}

export function ArtistForm({
  action,
  values = {},
}: {
  action: FormAction;
  values?: ArtistFormValues;
}) {
  return (
    <AdminActionForm
      action={action}
      submitLabel={values.id ? "Salvar alterações" : "Cadastrar artista"}
    >
      {values.id ? <input name="id" type="hidden" value={values.id} /> : null}
      <input name="photoPath" type="hidden" value={values.photoPath ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <AdminTextField
          defaultValue={values.artisticName}
          label="Nome artístico ou comercial *"
          maxLength={160}
          name="artisticName"
          required
        />
        <AdminTextField
          defaultValue={values.instagramHandle ?? ""}
          hint="Somente o nome do perfil, sem URL."
          label="Instagram público"
          maxLength={30}
          name="instagramHandle"
          placeholder="lojacollablumiar"
        />
      </div>
      <AdminTextareaField
        defaultValue={values.biography}
        hint="Conteúdo público; não inclua dados pessoais ou bancários."
        label="Apresentação e biografia *"
        name="biography"
        required
        rows={8}
      />
      <AdminTextField
        defaultValue={values.photoPath ?? ""}
        disabled
        hint="Será preenchido pelo armazenamento privado quando ele for autorizado."
        label="Foto de perfil"
        name="photoPathDisplay"
        placeholder="Upload indisponível nesta etapa"
      />
      <AdminCheckboxField
        defaultChecked={values.isActive ?? true}
        hint="Desative para preservar vínculos e retirar o artista das futuras consultas públicas."
        label="Artista ativo"
        name="isActive"
      />
    </AdminActionForm>
  );
}

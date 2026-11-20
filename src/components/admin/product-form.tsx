"use client";

import {
  AdminActionForm,
  AdminSelectField,
  AdminTextareaField,
  AdminTextField,
} from "@/components/admin/admin-form";
import type { AdminActionState } from "@/lib/admin/types";
import { formatPriceInput } from "@/lib/admin/validation";

type FormAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export function ProductForm({
  action,
  artists,
  categories,
  policies = [],
  values,
}: {
  action: FormAction;
  artists: { id: string; name: string; isActive: boolean }[];
  categories: { id: string; name: string }[];
  policies?: { id: string; code: string; version: number }[];
  values?: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string | null;
    artistId?: string;
    categoryIds?: string[];
    material?: string | null;
    productionTechnique?: string | null;
    priceInCents?: number;
    publicationStatus?: "draft" | "published" | "archived";
    artistCostInCents?: number;
    policyId?: string;
  };
}) {
  const selectedCategories = new Set(values?.categoryIds ?? []);

  return (
    <AdminActionForm
      action={action}
      submitLabel={values?.id ? "Salvar produto" : "Criar rascunho"}
    >
      {values?.id ? <input name="id" type="hidden" value={values.id} /> : null}
      <input
        name="publicationStatus"
        type="hidden"
        value={values?.publicationStatus === "archived" ? "archived" : "draft"}
      />
      <section className="grid gap-5 rounded-2xl border border-brand/12 bg-surface p-5">
        <div>
          <p className="eyebrow">1 · Informações básicas</p>
          <h2 className="mt-2 font-display text-3xl text-brand">
            Identificação
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <AdminTextField
            defaultValue={values?.name}
            label="Nome do produto *"
            maxLength={180}
            name="name"
            required
          />
          <AdminTextField
            defaultValue={values?.slug}
            hint="Se ficar vazio, será derivado do nome."
            label="Slug"
            maxLength={200}
            name="slug"
          />
        </div>
        <AdminTextareaField
          defaultValue={values?.description}
          label="Descrição"
          name="description"
          rows={6}
        />
      </section>

      <section className="grid gap-5 rounded-2xl border border-brand/12 bg-surface p-5">
        <div>
          <p className="eyebrow">2 · Autoria e categorias</p>
          <h2 className="mt-2 font-display text-3xl text-brand">Organização</h2>
        </div>
        <AdminSelectField
          defaultValue={values?.artistId ?? ""}
          label="Artista responsável *"
          name="artistId"
          required
        >
          <option disabled value="">
            Selecione um artista
          </option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
              {artist.isActive ? "" : " — inativo"}
            </option>
          ))}
        </AdminSelectField>
        <fieldset>
          <legend className="text-sm font-bold text-ink">Categorias</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm"
                key={category.id}
              >
                <input
                  className="size-4 accent-brand"
                  defaultChecked={selectedCategories.has(category.id)}
                  name="categoryIds"
                  type="checkbox"
                  value={category.id}
                />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="grid gap-5 rounded-2xl border border-brand/12 bg-surface p-5">
        <div>
          <p className="eyebrow">3 · Produção e preço</p>
          <h2 className="mt-2 font-display text-3xl text-brand">
            Dados comerciais
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <AdminTextField
            defaultValue={values?.material ?? ""}
            label="Material"
            name="material"
          />
          <AdminTextField
            defaultValue={values?.productionTechnique ?? ""}
            label="Técnica de produção"
            name="productionTechnique"
          />
        </div>
        <AdminTextField
          defaultValue={formatPriceInput(values?.priceInCents ?? 0)}
          hint="Valor provisório para o rascunho. Uma precificação validada substituirá este valor no catálogo."
          inputMode="decimal"
          label="Preço provisório em reais *"
          name="price"
          required
        />
      </section>

      <section className="grid gap-5 rounded-2xl border border-brand/12 bg-surface p-5">
        <div>
          <p className="eyebrow">4 · Precificação e repasses</p>
          <h2 className="mt-2 font-display text-3xl text-brand">
            Custo do artista
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            O servidor acrescenta 40% ao custo e separa metade do adicional para
            cada parte. Taxas, tributos e frete não são descontados desse
            adicional.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <AdminTextField
            defaultValue={formatPriceInput(values?.artistCostInCents ?? null)}
            hint="Pode ficar vazio enquanto a negociação estiver pendente."
            inputMode="decimal"
            label="Custo acordado com o artista (R$)"
            name="artistCost"
          />
          <AdminSelectField
            defaultValue={values?.policyId ?? ""}
            label="Política comercial aprovada"
            name="financialPolicyId"
          >
            <option value="">Pendente</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.code} · v{policy.version}
              </option>
            ))}
          </AdminSelectField>
        </div>
        <p className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs leading-5 text-muted">
          O custo pode ser registrado agora. A escolha de taxas, tributos,
          modalidade e validação final ocorre nos detalhes do produto.
        </p>
      </section>

      <p className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm leading-6 text-muted">
        O formulário salva em rascunho. Publicação é uma ação separada e só
        conclui quando categoria, variação padrão ativa, imagem principal e
        campos obrigatórios satisfazem os triggers do PostgreSQL.
      </p>
    </AdminActionForm>
  );
}

"use client";

import {
  AdminActionForm,
  AdminCheckboxField,
  AdminTextField,
} from "@/components/admin/admin-form";
import type { AdminActionState } from "@/lib/admin/types";
import { formatPriceInput } from "@/lib/admin/validation";

type FormAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export function VariationForm({
  action,
  productId,
  variationId,
  values,
}: {
  action: FormAction;
  productId: string;
  variationId?: string;
  values?: {
    sku: string;
    color: string | null;
    size: string | null;
    availableQuantity: number;
    specificPriceInCents: number | null;
    isActive: boolean;
    isDefault: boolean;
  };
}) {
  return (
    <AdminActionForm
      action={action}
      submitLabel={variationId ? "Salvar variação" : "Adicionar variação"}
    >
      <input name="productId" type="hidden" value={productId} />
      {variationId ? (
        <input name="id" type="hidden" value={variationId} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminTextField
          defaultValue={values?.sku}
          label="SKU *"
          maxLength={80}
          name="sku"
          required
        />
        <AdminTextField
          defaultValue={values?.color ?? ""}
          label="Cor"
          maxLength={80}
          name="color"
        />
        <AdminTextField
          defaultValue={values?.size ?? ""}
          label="Tamanho"
          maxLength={80}
          name="size"
        />
        {variationId ? (
          <div className="grid gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm">
            <span className="font-bold text-ink">Estoque atual</span>
            <strong className="text-lg text-brand">
              {values?.availableQuantity ?? 0}
            </strong>
            <span className="text-xs text-muted">
              Ajuste quantidades somente na área Estoque.
            </span>
            <input
              name="availableQuantity"
              type="hidden"
              value={values?.availableQuantity ?? 0}
            />
          </div>
        ) : (
          <AdminTextField
            defaultValue={0}
            label="Estoque inicial *"
            min={0}
            name="availableQuantity"
            required
            type="number"
          />
        )}
        <AdminTextField
          defaultValue={formatPriceInput(values?.specificPriceInCents ?? null)}
          hint="Vazio usa o preço base."
          inputMode="decimal"
          label="Preço específico em reais"
          name="specificPrice"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminCheckboxField
          defaultChecked={values?.isActive ?? true}
          label="Variação ativa"
          name="isActive"
        />
        <AdminCheckboxField
          defaultChecked={values?.isDefault}
          hint="Só pode existir uma por produto."
          label="Variação padrão"
          name="isDefault"
        />
      </div>
    </AdminActionForm>
  );
}

type ShippingValues = {
  itemWeightGrams: number;
  itemHeightCm: number;
  itemWidthCm: number;
  itemLengthCm: number;
  packageWeightGrams: number;
  packageHeightCm: number;
  packageWidthCm: number;
  packageLengthCm: number;
  isFragile: boolean;
  shipsSeparately: boolean;
  unitsPerPackage: number;
};

export function ShippingProfileForm({
  action,
  productId,
  variationId,
  values,
}: {
  action: FormAction;
  productId?: string;
  variationId?: string;
  values?: ShippingValues | null;
}) {
  const measurementFields = [
    ["itemWeightGrams", "Peso do item (g)", values?.itemWeightGrams],
    ["itemHeightCm", "Altura do item (cm)", values?.itemHeightCm],
    ["itemWidthCm", "Largura do item (cm)", values?.itemWidthCm],
    ["itemLengthCm", "Comprimento do item (cm)", values?.itemLengthCm],
    ["packageWeightGrams", "Peso embalado (g)", values?.packageWeightGrams],
    ["packageHeightCm", "Altura embalada (cm)", values?.packageHeightCm],
    ["packageWidthCm", "Largura embalada (cm)", values?.packageWidthCm],
    ["packageLengthCm", "Comprimento embalado (cm)", values?.packageLengthCm],
  ] as const;

  return (
    <AdminActionForm action={action} submitLabel="Salvar logística">
      <input name="productId" type="hidden" value={productId ?? ""} />
      <input name="variationId" type="hidden" value={variationId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {measurementFields.map(([name, label, value]) => (
          <AdminTextField
            defaultValue={value ?? ""}
            inputMode="decimal"
            key={name}
            label={`${label} *`}
            min="0.01"
            name={name}
            required
          />
        ))}
        <AdminTextField
          defaultValue={values?.unitsPerPackage ?? 1}
          label="Unidades por embalagem *"
          min={1}
          name="unitsPerPackage"
          required
          type="number"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminCheckboxField
          defaultChecked={values?.isFragile}
          label="Produto frágil"
          name="isFragile"
        />
        <AdminCheckboxField
          defaultChecked={values?.shipsSeparately}
          hint="Exige uma unidade por embalagem."
          label="Enviar separadamente"
          name="shipsSeparately"
        />
      </div>
    </AdminActionForm>
  );
}

export function StockAdjustmentForm({
  action,
  variationId,
  quantity,
  updatedAt,
}: {
  action: FormAction;
  variationId: string;
  quantity: number;
  updatedAt: Date;
}) {
  return (
    <AdminActionForm
      action={action}
      className="flex min-w-[15rem] flex-wrap items-end gap-2"
      submitLabel="Atualizar"
    >
      <input name="variationId" type="hidden" value={variationId} />
      <input name="expectedAvailableQuantity" type="hidden" value={quantity} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={updatedAt.toISOString()}
      />
      <AdminTextField
        defaultValue={quantity}
        label="Quantidade"
        min={0}
        name="availableQuantity"
        required
        type="number"
      />
    </AdminActionForm>
  );
}

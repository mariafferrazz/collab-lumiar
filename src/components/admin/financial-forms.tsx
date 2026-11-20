"use client";

import {
  AdminActionForm,
  AdminCheckboxField,
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

export function FinancialPolicyForm({ action }: { action: FormAction }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AdminActionForm action={action} submitLabel="Registrar política">
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminTextField
          label="Código *"
          name="code"
          placeholder="COLLAB_STANDARD"
          required
        />
        <AdminTextField
          defaultValue={1}
          label="Versão *"
          min={1}
          name="version"
          required
          type="number"
        />
        <AdminTextField
          defaultValue={today}
          label="Início da vigência *"
          name="effectiveFrom"
          required
          type="date"
        />
        <AdminTextField
          label="Fim da vigência"
          name="effectiveUntil"
          type="date"
        />
      </div>
      <AdminTextareaField
        hint="Ata, decisão assinada ou referência interna verificável. Não inclua credenciais."
        label="Fonte da aprovação *"
        name="source"
        required
        rows={3}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ValueCard label="Adicional comercial" value="40% do custo" />
        <ValueCard label="Proprietária" value="50% do adicional" />
        <ValueCard label="Organizadora" value="50% do adicional" />
      </div>
      <AdminCheckboxField
        hint="Após aprovada, a versão não poderá ser editada nem excluída. Correções exigem nova versão."
        label="Aprovar esta versão agora"
        name="approve"
      />
    </AdminActionForm>
  );
}

export function FinancialChargeRuleForm({ action }: { action: FormAction }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AdminActionForm action={action} submitLabel="Registrar parâmetro">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminSelectField label="Tipo *" name="kind" required>
          <option value="payment_fee">Taxa de pagamento</option>
          <option value="tax">Tributo</option>
        </AdminSelectField>
        <AdminTextField label="Nome *" maxLength={160} name="name" required />
        <AdminTextField
          hint="Obrigatória para taxa de pagamento, por exemplo pix ou credit_card."
          label="Modalidade"
          maxLength={60}
          name="paymentMethod"
        />
        <AdminTextField
          defaultValue="0,00"
          hint="Percentual exato, com até duas casas."
          inputMode="decimal"
          label="Percentual (%) *"
          name="percentage"
          required
        />
        <AdminTextField
          defaultValue="0,00"
          inputMode="decimal"
          label="Valor fixo (R$)"
          name="fixedAmount"
        />
        <AdminSelectField
          label="Base de incidência *"
          name="incidenceBase"
          required
        >
          <option value="commercial_base">Preço comercial base</option>
          <option value="final_merchandise">Preço final da mercadoria</option>
          <option value="shipping">Frete</option>
          <option value="transaction_total">Total da transação</option>
        </AdminSelectField>
        <AdminSelectField label="Aplicação *" name="applicationScope" required>
          <option value="per_item">Por item</option>
          <option value="per_order">Uma vez por pedido</option>
        </AdminSelectField>
        <AdminTextField
          defaultValue={today}
          label="Início da vigência *"
          name="effectiveFrom"
          required
          type="date"
        />
        <AdminTextField
          label="Fim da vigência"
          name="effectiveUntil"
          type="date"
        />
      </div>
      <AdminTextareaField
        hint="Condição comercial confirmada ou orientação contábil. Não trate estimativas como oficiais."
        label="Fonte validada *"
        name="source"
        required
        rows={3}
      />
      <AdminCheckboxField
        hint="Aprovação torna a regra imutável. Uma mudança futura exige outra regra com nova vigência."
        label="Aprovar este parâmetro agora"
        name="approve"
      />
    </AdminActionForm>
  );
}

export function ProductFinancialPricingForm({
  action,
  productId,
  variationId,
  targetLabel,
  policies,
  rules,
  artistCostInCents,
}: {
  action: FormAction;
  productId?: string;
  variationId?: string;
  targetLabel: string;
  policies: { id: string; code: string; version: number }[];
  rules: {
    id: string;
    kind: "payment_fee" | "tax";
    name: string;
    paymentMethod: string | null;
    applicationScope: "per_item" | "per_order";
  }[];
  artistCostInCents?: number;
}) {
  const paymentRules = rules.filter((rule) => rule.kind === "payment_fee");
  const taxRules = rules.filter((rule) => rule.kind === "tax");
  return (
    <AdminActionForm action={action} submitLabel="Calcular e salvar">
      <input name="productId" type="hidden" value={productId ?? ""} />
      <input name="variationId" type="hidden" value={variationId ?? ""} />
      <div>
        <p className="eyebrow">Precificação e repasses</p>
        <h3 className="mt-2 font-display text-2xl text-brand">{targetLabel}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          O servidor calcula custo + 40%, divide o adicional igualmente e aplica
          somente parâmetros aprovados. O frete permanece separado.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminTextField
          defaultValue={formatPriceInput(artistCostInCents ?? null)}
          inputMode="decimal"
          label="Custo acordado com o artista (R$) *"
          name="artistCost"
          required
        />
        <AdminSelectField label="Política aprovada *" name="policyId" required>
          <option value="">Selecione</option>
          {policies.map((policy) => (
            <option key={policy.id} value={policy.id}>
              {policy.code} · v{policy.version}
            </option>
          ))}
        </AdminSelectField>
        <AdminTextField
          defaultValue="pix"
          label="Modalidade do cenário *"
          maxLength={60}
          name="paymentMethod"
          required
        />
        <AdminSelectField
          label="Taxa de pagamento aprovada"
          name="paymentFeeRuleId"
        >
          <option value="">Pendente</option>
          {paymentRules.map((rule) => (
            <option
              disabled={rule.applicationScope !== "per_item"}
              key={rule.id}
              value={rule.id}
            >
              {rule.name}
              {rule.applicationScope === "per_order"
                ? " — somente por pedido"
                : ""}
            </option>
          ))}
        </AdminSelectField>
        <AdminSelectField label="Regra tributária aprovada" name="taxRuleId">
          <option value="">Pendente</option>
          {taxRules.map((rule) => (
            <option
              disabled={rule.applicationScope !== "per_item"}
              key={rule.id}
              value={rule.id}
            >
              {rule.name}
              {rule.applicationScope === "per_order"
                ? " — somente por pedido"
                : ""}
            </option>
          ))}
        </AdminSelectField>
      </div>
      <AdminCheckboxField
        hint="Somente um cenário padrão poderá definir o preço exibido no catálogo. A validação final é uma ação separada."
        label="Usar como cenário padrão"
        name="isDefault"
      />
    </AdminActionForm>
  );
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand/10 bg-background p-4 text-sm">
      <span className="text-muted">{label}</span>
      <strong className="mt-1 block text-brand">{value}</strong>
    </div>
  );
}

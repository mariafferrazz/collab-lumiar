import type { Metadata } from "next";

import {
  createFinancialChargeRuleAction,
  createFinancialPolicyAction,
} from "@/app/admin/actions";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
} from "@/components/admin/admin-ui";
import {
  FinancialChargeRuleForm,
  FinancialPolicyForm,
} from "@/components/admin/financial-forms";
import { formatPrice } from "@/lib/format";
import { requireAdminSession } from "@/lib/server/auth-session";
import { financialService } from "@/lib/server/financial/service";

export const metadata: Metadata = {
  title: "Financeiro — Administração",
};

export default async function FinancialAdminPage() {
  await requireAdminSession();
  const [dashboard, policies, rules] = await Promise.all([
    financialService.dashboard(),
    financialService.policies(),
    financialService.rules(),
  ]);
  const { metrics } = dashboard;

  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Financeiro" },
        ]}
      />
      <AdminPageHeader
        description="Configuração de custos, adicional comercial, encargos e validação de preços. Não há vendas, faturamento ou saldo bancário neste módulo."
        eyebrow="Módulo financeiro"
        title="Precificação verificável"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Custos cadastrados" value={metrics.costs} />
        <AdminMetricCard
          label="Cenários calculados"
          value={metrics.scenarios}
        />
        <AdminMetricCard
          label="Preços validados"
          value={metrics.validatedScenarios}
        />
        <AdminMetricCard
          label="Parâmetros aprovados"
          note={`${metrics.approvedPolicies} política(s) e ${metrics.approvedRules} regra(s)`}
          value={metrics.approvedPolicies + metrics.approvedRules}
        />
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">Visão operacional</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            [
              "Vendas e receita",
              "Aguardando o futuro módulo de pedidos e pagamentos.",
            ],
            [
              "Artistas e repasses",
              "Nenhum repasse é elegível sem política de conclusão de venda aprovada.",
            ],
            [
              "Frete e conciliação",
              "Melhor Envio e Mercado Pago permanecem desconectados.",
            ],
            [
              "Despesas",
              "Classificação e comprovação dependem de política operacional futura.",
            ],
            [
              "Tributos apurados",
              "Parâmetros de formação de preço não substituem apuração contábil.",
            ],
            [
              "Relatórios",
              "Disponíveis quando existirem eventos financeiros legítimos e snapshots de pedidos.",
            ],
          ].map(([title, description]) => (
            <article
              className="rounded-xl border border-dashed border-brand/20 bg-background p-4"
              key={title}
            >
              <h3 className="font-bold text-brand">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
          <h2 className="font-display text-3xl text-brand">
            Política comercial
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            O acordo é fixo: 40% sobre o custo, dividido em partes iguais. Não
            existe campo para alterar silenciosamente esses percentuais.
          </p>
          <div className="mt-6">
            <FinancialPolicyForm action={createFinancialPolicyAction} />
          </div>
        </section>
        <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
          <h2 className="font-display text-3xl text-brand">
            Políticas registradas
          </h2>
          {policies.length ? (
            <ul className="mt-5 divide-y divide-brand/10">
              {policies.map((policy) => (
                <li className="py-4 text-sm" key={policy.id}>
                  <strong>
                    {policy.code} · versão {policy.version}
                  </strong>
                  <p className="mt-1 text-xs text-muted">
                    {policy.status === "approved"
                      ? "Aprovada e imutável"
                      : "Rascunho"}{" "}
                    · vigência desde{" "}
                    {policy.effectiveFrom.toLocaleDateString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState
              description="Registre a decisão comercial antes de validar preços."
              title="Nenhuma política"
            />
          )}
        </section>
      </div>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">Taxas e tributos</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Cadastre somente condições confirmadas. Uma regra tributária de 0%
          também precisa de fonte contábil explícita.
        </p>
        <div className="mt-6">
          <FinancialChargeRuleForm action={createFinancialChargeRuleAction} />
        </div>
        {rules.length ? (
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand/10 text-xs uppercase text-muted">
                <tr>
                  <th className="py-3 pr-4">Regra</th>
                  <th className="py-3 pr-4">Incidência</th>
                  <th className="py-3 pr-4">Valores</th>
                  <th className="py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-3 pr-4">
                      <strong>{rule.name}</strong>
                      <span className="block text-xs text-muted">
                        {rule.kind === "tax" ? "Tributo" : rule.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {rule.incidenceBase} · {rule.applicationScope}
                    </td>
                    <td className="py-3 pr-4">
                      {(rule.percentageBasisPoints / 100).toFixed(2)}% +{" "}
                      {formatPrice(rule.fixedAmountInCents)}
                    </td>
                    <td className="py-3">
                      {rule.status === "approved" ? "Aprovada" : "Rascunho"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-brand p-6 text-cream">
        <h2 className="font-display text-3xl">Sem movimentações financeiras</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-cream/75">
          Não existem pedidos, vendas, repasses, despesas pagas, tributos
          apurados ou fretes contratados. Os números desta tela representam
          somente configurações e precificações cadastradas.
        </p>
      </section>
    </div>
  );
}

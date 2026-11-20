import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createVariationAction,
  removeImageMetadataAction,
  requestImageUploadAction,
  saveProductFinancialPricingAction,
  setProductStatusAction,
  updateVariationAction,
  upsertShippingProfileAction,
  validateProductPricingScenarioAction,
} from "@/app/admin/actions";
import { AdminMutationForm } from "@/components/admin/admin-form";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { ProductFinancialPricingForm } from "@/components/admin/financial-forms";
import {
  ShippingProfileForm,
  VariationForm,
} from "@/components/admin/product-dependent-forms";
import { isUuid } from "@/lib/admin/validation";
import { formatPrice } from "@/lib/format";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";
import { financialService } from "@/lib/server/financial/service";

export const metadata: Metadata = {
  title: "Detalhes do produto — Administração",
};

export default async function ProductDetailPage({
  params,
}: PageProps<"/admin/produtos/[id]">) {
  await requireAdminSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [detail, policies, rules, pricing, scenarios] = await Promise.all([
    adminCatalog.product(id),
    financialService.policies(),
    financialService.rules(),
    financialService.productPricing(id),
    financialService.productScenarios(id),
  ]);
  if (!detail) notFound();
  const { product } = detail;
  const approvedPolicies = policies.filter(
    (policy) => policy.status === "approved",
  );
  const approvedRules = rules.filter((rule) => rule.status === "approved");
  const productCost = pricing.find((item) => item.cost.productId === id)?.cost;

  return (
    <div className="grid gap-6">
      <AdminBreadcrumbs
        items={[
          { label: "Administração", href: "/admin" },
          { label: "Produtos", href: "/admin/produtos" },
          { label: product.name },
        ]}
      />
      <AdminPageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              className="button-secondary"
              href={`/admin/produtos/${id}/preview`}
            >
              Ver prévia privada
            </Link>
            <Link
              className="button-primary"
              href={`/admin/produtos/${id}/editar`}
            >
              Editar dados
            </Link>
          </div>
        }
        description={`${product.artistName} · ${formatPrice(product.priceInCents)}`}
        eyebrow="Produto"
        title={product.name}
      />

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand/12 bg-surface p-5">
        <AdminStatusBadge status={product.publicationStatus} />
        {product.publicationStatus !== "published" ? (
          <AdminMutationForm
            action={setProductStatusAction}
            confirmMessage="Publicar agora? O banco validará categoria, variação padrão ativa, imagem principal e campos obrigatórios."
            fields={{ id, status: "published" }}
            label="Publicar"
            tone="primary"
          />
        ) : (
          <AdminMutationForm
            action={setProductStatusAction}
            confirmMessage="Mover este produto publicado para rascunho?"
            fields={{ id, status: "draft" }}
            label="Voltar a rascunho"
          />
        )}
        {product.publicationStatus !== "archived" ? (
          <AdminMutationForm
            action={setProductStatusAction}
            confirmMessage="Arquivar este produto?"
            fields={{ id, status: "archived" }}
            label="Arquivar"
            tone="danger"
          />
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">
          Revisão para publicação
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReviewItem
            label="Descrição"
            ready={Boolean(product.description?.trim())}
          />
          <ReviewItem
            label="Material e técnica"
            ready={Boolean(
              product.material?.trim() && product.productionTechnique?.trim(),
            )}
          />
          <ReviewItem label="Categoria" ready={detail.categories.length > 0} />
          <ReviewItem
            label="Variação padrão ativa"
            ready={detail.variations.some(
              (variation) => variation.isActive && variation.isDefault,
            )}
          />
          <ReviewItem
            label="Imagem principal"
            ready={detail.images.some((image) => image.isPrimary)}
          />
          <ReviewItem
            label="Logística"
            ready={Boolean(detail.shippingProfile)}
            optional
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">
          Precificação e repasses
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          O custo do artista permanece separado do adicional comercial, dos
          encargos e do frete. Nenhum valor é tratado como venda ou saldo
          disponível.
        </p>
        <div className="mt-6">
          <ProductFinancialPricingForm
            action={saveProductFinancialPricingAction}
            artistCostInCents={productCost?.artistCostInCents}
            policies={approvedPolicies}
            productId={id}
            rules={approvedRules}
            targetLabel="Preço principal do produto"
          />
        </div>
        {scenarios.length ? (
          <div className="mt-6 grid gap-3 border-t border-brand/10 pt-6">
            {scenarios.map(({ scenario, cost }) => (
              <article
                className="rounded-xl border border-brand/10 bg-background p-4"
                key={scenario.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <strong>
                      {cost.variationId ? "Variação" : "Produto"} ·{" "}
                      {scenario.paymentMethod}
                    </strong>
                    <p className="mt-1 text-xs text-muted">
                      Artista {formatPrice(cost.artistCostInCents)} · adicional{" "}
                      {formatPrice(cost.commercialAdditionInCents)} ·
                      proprietária {formatPrice(cost.ownerShareInCents)} ·
                      organizadora {formatPrice(cost.organizerShareInCents)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Encargos{" "}
                      {formatPrice(
                        (scenario.expectedPaymentFeeInCents ?? 0) +
                          (scenario.expectedTaxInCents ?? 0),
                      )}{" "}
                      · preço calculado{" "}
                      {formatPrice(scenario.finalMerchandisePriceInCents ?? 0)}{" "}
                      · {scenario.status}
                    </p>
                  </div>
                  {scenario.status === "pending_validation" &&
                  scenario.isDefault ? (
                    <AdminMutationForm
                      action={validateProductPricingScenarioAction}
                      confirmMessage="Validar este cenário e sincronizar o preço do catálogo? A versão financeira se tornará imutável."
                      fields={{ id: scenario.id }}
                      label="Validar preço"
                      tone="primary"
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-brand/20 p-4 text-sm text-muted">
            Nenhum cenário calculado. Sem política, taxa e tributo aprovados, o
            preço definitivo permanece pendente.
          </p>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">Variações e preço</h2>
        {detail.variations.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand/10 text-xs uppercase text-muted">
                <tr>
                  <th className="py-3 pr-4">SKU</th>
                  <th className="py-3 pr-4">Atributos</th>
                  <th className="py-3 pr-4">Preço</th>
                  <th className="py-3">Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand/10">
                {detail.variations.map((variation) => (
                  <tr key={variation.id}>
                    <td className="py-3 pr-4 font-bold">
                      {variation.sku}
                      {variation.isDefault ? " · padrão" : ""}
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {[variation.color, variation.size]
                        .filter(Boolean)
                        .join(" · ") || "Sem atributos"}
                    </td>
                    <td className="py-3 pr-4">
                      {formatPrice(
                        variation.specificPriceInCents ?? product.priceInCents,
                      )}
                    </td>
                    <td className="py-3">{variation.availableQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            description="Adicione ao menos uma variação ativa e padrão antes de publicar."
            title="Nenhuma variação"
          />
        )}
        <div className="mt-6 border-t border-brand/10 pt-6">
          <VariationForm action={createVariationAction} productId={id} />
        </div>
        {detail.variations.length ? (
          <div className="mt-6 grid gap-4 border-t border-brand/10 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-muted">
              Editar variações e logística específica
            </h3>
            {detail.variations.map((variation) => (
              <details
                className="rounded-xl border border-brand/10 bg-background p-4"
                key={variation.id}
              >
                <summary className="cursor-pointer font-bold text-brand">
                  {variation.sku}
                </summary>
                <div className="mt-5 grid gap-6">
                  <VariationForm
                    action={updateVariationAction}
                    productId={id}
                    values={variation}
                    variationId={variation.id}
                  />
                  <div className="border-t border-brand/10 pt-5">
                    <ProductFinancialPricingForm
                      action={saveProductFinancialPricingAction}
                      artistCostInCents={
                        pricing.find(
                          (item) => item.cost.variationId === variation.id,
                        )?.cost.artistCostInCents
                      }
                      policies={approvedPolicies}
                      rules={approvedRules}
                      targetLabel={`Precificação da variação ${variation.sku}`}
                      variationId={variation.id}
                    />
                  </div>
                  <div className="border-t border-brand/10 pt-5">
                    <p className="mb-4 text-sm text-muted">
                      Medidas específicas substituem o perfil do produto para
                      esta variação.
                    </p>
                    <ShippingProfileForm
                      action={upsertShippingProfileAction}
                      values={
                        detail.variationShippingProfiles.find(
                          (profile) => profile.variationId === variation.id,
                        ) ?? null
                      }
                      variationId={variation.id}
                    />
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">Imagens</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          A galeria e os metadados existentes podem ser revisados. Upload real
          permanece bloqueado até existir armazenamento privado autorizado; URLs
          arbitrárias e filesystem efêmero não são aceitos.
        </p>
        {detail.images.length ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {detail.images.map((image) => (
              <li
                className="rounded-xl border border-brand/10 bg-background p-4 text-sm"
                key={image.id}
              >
                <strong>
                  {image.isPrimary ? "Principal · " : ""}ordem{" "}
                  {image.displayOrder}
                </strong>
                <p className="mt-2 text-muted">{image.altText}</p>
                <code className="mt-2 block break-all text-xs text-muted">
                  {image.filePath}
                </code>
                <div className="mt-4">
                  <AdminMutationForm
                    action={removeImageMetadataAction}
                    confirmMessage="Remover o vínculo desta imagem? O objeto no armazenamento não será apagado automaticamente."
                    fields={{ id: image.id }}
                    label="Remover vínculo"
                    tone="danger"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmptyState
            description="Nenhuma fotografia vinculada. A publicação permanecerá bloqueada."
            title="Galeria vazia"
          />
        )}
        <div className="mt-5">
          <AdminMutationForm
            action={requestImageUploadAction}
            fields={{ productId: id }}
            label="Preparar upload"
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-brand/12 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-3xl text-brand">Logística</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Registre item e embalagem pronta separadamente. Nenhuma cotação do
          Melhor Envio é realizada.
        </p>
        <div className="mt-6">
          <ShippingProfileForm
            action={upsertShippingProfileAction}
            productId={id}
            values={detail.shippingProfile}
          />
        </div>
      </section>
    </div>
  );
}

function ReviewItem({
  label,
  ready,
  optional = false,
}: {
  label: string;
  ready: boolean;
  optional?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${ready ? "border-success/20 bg-success/8 text-success" : "border-error/20 bg-error/8 text-error"}`}
    >
      <strong>{ready ? "Pronto" : optional ? "Pendente" : "Ausente"}</strong>
      <p className="mt-1 text-xs">
        {label}
        {optional ? " · recomendado" : ""}
      </p>
    </div>
  );
}

import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Carrinho",
  description: "Estrutura visual demonstrativa do futuro carrinho da COLLAB.",
};

export default function CartPage() {
  return (
    <EmptyState
      eyebrow="Carrinho"
      title="Suas escolhas vão se encontrar aqui."
      description="A estrutura visual está pronta, mas adicionar itens, calcular totais e finalizar compras ainda não estão disponíveis."
      note="Carrinho, estoque, frete e checkout serão implementados em etapas futuras. Nenhuma compra pode ser concluída agora."
    />
  );
}

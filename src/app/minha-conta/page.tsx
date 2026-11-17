import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Minha conta",
  description:
    "Estrutura visual demonstrativa da futura área de conta da COLLAB.",
};

export default function AccountPage() {
  return (
    <EmptyState
      eyebrow="Minha conta"
      title="Sua relação com a COLLAB, em um só lugar."
      description="A área de conta reunirá dados pessoais, endereços, pedidos e preferências com controles adequados de privacidade."
      note="Não existe autenticação real nesta etapa. Nenhum dado pessoal é solicitado ou armazenado."
    />
  );
}

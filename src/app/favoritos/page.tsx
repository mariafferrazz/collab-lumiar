import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Favoritos",
  description:
    "Estrutura visual demonstrativa dos futuros favoritos da COLLAB.",
};

export default function FavoritesPage() {
  return (
    <EmptyState
      eyebrow="Favoritos"
      title="Um lugar para guardar o que toca você."
      description="A futura lista de favoritos reunirá produtos e artistas para consultar depois."
      note="Salvar e persistir favoritos depende de autenticação e banco de dados, ainda não implementados."
    />
  );
}

import type { PublicCatalogSource } from "@/types/public-catalog";

export function CatalogModeNotice({ source }: { source: PublicCatalogSource }) {
  return (
    <p className="rounded-2xl border border-brand/15 bg-surface px-5 py-4 text-sm leading-6 text-ink/65">
      <strong className="text-ink">
        {source === "demo"
          ? "Catálogo demonstrativo"
          : "Catálogo do desenvolvimento local"}
        :{" "}
      </strong>
      {source === "demo"
        ? "nomes, imagens, valores e produtos são fictícios e estão claramente separados do banco persistido."
        : "esta visualização lê somente conteúdos públicos do PostgreSQL local isolado; nenhum dado da Railway é consultado."}
    </p>
  );
}

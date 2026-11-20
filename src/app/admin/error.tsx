"use client";

export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-error/20 bg-surface p-8">
      <p className="eyebrow">Falha temporária</p>
      <h1 className="mt-3 font-display text-4xl text-brand">
        Não foi possível carregar o painel.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
        Nenhuma alteração foi realizada. Tente novamente; se o problema
        persistir, revise a conexão local sem compartilhar dados sensíveis.
      </p>
      <button className="button-primary mt-6" onClick={retry} type="button">
        Tentar novamente
      </button>
    </div>
  );
}

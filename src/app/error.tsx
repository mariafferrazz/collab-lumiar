"use client";

import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A mensagem pode conter detalhes internos; o navegador registra somente o digest.
    if (error.digest) console.error(`Falha pública: ${error.digest}`);
  }, [error.digest]);

  return (
    <main id="conteudo" className="page-shell py-20">
      <section className="mx-auto max-w-2xl rounded-[1.75rem] border border-brand/15 bg-surface p-8 text-center sm:p-12">
        <p className="eyebrow">Catálogo temporariamente indisponível</p>
        <h1 className="mt-4 font-display text-5xl text-ink">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-5 text-sm leading-7 text-ink/65">
          A conexão local pode estar iniciando ou indisponível. Nenhum conteúdo
          demonstrativo foi usado como fallback.
        </p>
        <button className="button-primary mt-7" type="button" onClick={reset}>
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

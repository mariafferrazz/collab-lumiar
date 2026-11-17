import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main id="conteudo" className="page-shell py-16 text-center sm:py-24">
      <p className="eyebrow">Erro 404</p>
      <h1 className="mx-auto mt-4 max-w-3xl font-display text-6xl leading-[0.9] tracking-[-0.05em] text-ink sm:text-8xl">
        Esse caminho ainda não virou trilha.
      </h1>
      <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-ink/65">
        A página que você procurou não existe ou ainda não foi publicada na
        COLLAB.
      </p>
      <Link className="button-primary mt-8" href="/">
        Voltar ao início
        <ArrowRightIcon className="size-4" />
      </Link>
    </main>
  );
}

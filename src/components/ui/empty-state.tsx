import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/icons";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  note,
}: EmptyStateProps) {
  return (
    <main id="conteudo" className="page-shell py-12 sm:py-20">
      <section className="overflow-hidden rounded-[2rem] border border-brand/15 bg-surface px-6 py-14 sm:px-12 sm:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.92] tracking-[-0.045em] text-ink sm:text-7xl">
          {title}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/70">
          {description}
        </p>
        <div className="mt-9 rounded-2xl border border-brand/20 bg-background/65 p-5 text-sm leading-6 text-ink/70">
          <strong className="text-ink">Estado da demonstração:</strong> {note}
        </div>
        <Link className="button-primary mt-8" href="/produtos">
          Explorar produtos
          <ArrowRightIcon className="size-4" />
        </Link>
      </section>
    </main>
  );
}

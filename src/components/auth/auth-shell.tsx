import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  alternate?: { text: string; href: string; label: string };
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  alternate,
}: AuthShellProps) {
  return (
    <main id="conteudo" className="page-shell py-12 sm:py-20">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-brand/15 bg-surface shadow-[0_28px_80px_rgba(82,31,33,0.1)] lg:grid-cols-[0.85fr_1.15fr]">
        <section className="bg-brand px-6 py-10 text-cream sm:px-10 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream/70">
            {eyebrow}
          </p>
          <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-cream/80 sm:text-base">
            {description}
          </p>
          <p className="mt-8 border-t border-cream/20 pt-6 text-xs leading-6 text-cream/65">
            Sua senha é processada pelo Better Auth e nunca é registrada nos
            logs da COLLAB.
          </p>
        </section>

        <section className="px-6 py-10 sm:px-10 sm:py-14">
          {children}
          {alternate ? (
            <p className="mt-8 border-t border-ink/10 pt-6 text-center text-sm text-muted">
              {alternate.text}{" "}
              <Link
                className="font-bold text-brand hover:text-brand-hover"
                href={alternate.href}
              >
                {alternate.label}
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

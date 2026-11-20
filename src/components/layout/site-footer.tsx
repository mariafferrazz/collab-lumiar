import Link from "next/link";

import { CollabLogo } from "@/components/brand/collab-logo";
import { InstagramIcon } from "@/components/ui/icons";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-brand text-cream">
      <div className="page-shell grid gap-12 py-14 md:grid-cols-[1.2fr_1fr_1fr] md:py-20">
        <div className="max-w-md">
          <Link
            className="inline-flex rounded-xl bg-background p-3 transition-opacity hover:opacity-90"
            href="/"
            aria-label="COLLAB Lumiar — página inicial"
          >
            <CollabLogo className="w-52 sm:w-60" sizes="15rem" />
          </Link>
          <p className="mt-6 text-sm leading-7 text-cream/75">
            Uma vitrine coletiva para produtos autorais de artistas e produtores
            da região de Lumiar e Nova Friburgo, RJ.
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-cream/70">
            Feito na serra · compartilhado com o mundo
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <h2 className="font-bold text-cream">Explore</h2>
            <ul className="mt-4 grid gap-3 text-cream/70">
              <li>
                <Link className="hover:text-cream" href="/produtos">
                  Produtos
                </Link>
              </li>
              <li>
                <Link className="hover:text-cream" href="/artistas">
                  Artistas
                </Link>
              </li>
              <li>
                <Link className="hover:text-cream" href="/categorias">
                  Categorias
                </Link>
              </li>
              <li>
                <Link className="hover:text-cream" href="/sobre">
                  Nossa história
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-bold text-cream">Institucional</h2>
            <ul className="mt-4 grid gap-3 text-cream/70">
              <li>
                <Link className="hover:text-cream" href="/sobre#contato">
                  Contato
                </Link>
              </li>
              <li>
                <Link className="hover:text-cream" href="/sobre#politicas">
                  Políticas da loja
                </Link>
              </li>
              <li>
                <Link className="hover:text-cream" href="/sobre#redes">
                  Redes sociais
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h2 className="font-bold text-cream">Acompanhe a COLLAB</h2>
          <p className="mt-4 text-sm leading-6 text-cream/70">
            A conexão oficial está preparada e aguarda a autorização da
            organizadora pela Meta.
          </p>
          <a
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cream/25 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-cream/85 transition hover:border-cream/50 hover:text-cream"
            href="https://www.instagram.com/lojacollablumiar/"
            target="_blank"
            rel="noreferrer"
          >
            <InstagramIcon className="size-4" />
            Visitar Instagram
          </a>
        </div>
      </div>

      <div className="border-t border-cream/15">
        <div className="page-shell flex flex-col gap-2 py-5 text-xs text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 COLLAB. Interface em preparação.</p>
          <p>Lumiar e Nova Friburgo · Rio de Janeiro</p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";

import { CollabLogo } from "@/components/brand/collab-logo";
import {
  CartIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";

const navigation = [
  { href: "/", label: "Início" },
  { href: "/produtos", label: "Produtos" },
  { href: "/artistas", label: "Artistas" },
  { href: "/sobre", label: "Sobre a Collab" },
];

const iconNavigation = [
  {
    href: "/produtos#catalogo",
    label: "Pesquisar produtos",
    icon: SearchIcon,
  },
  { href: "/favoritos", label: "Favoritos", icon: HeartIcon },
  { href: "/carrinho", label: "Carrinho", icon: CartIcon },
  { href: "/minha-conta", label: "Minha conta", icon: UserIcon },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand/15 bg-background/95 backdrop-blur-xl">
      <div className="page-shell relative flex min-h-[4.75rem] items-center justify-between gap-4 sm:min-h-24">
        <Link
          className="group block shrink-0 rounded-sm"
          href="/"
          aria-label="COLLAB Lumiar — página inicial"
        >
          <CollabLogo
            eager
            className="w-[9.6rem] transition-opacity group-hover:opacity-80 sm:w-[13.5rem]"
          />
        </Link>

        <nav className="hidden lg:block" aria-label="Navegação principal">
          <ul className="flex items-center gap-7">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link className="nav-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="hidden sm:block" aria-label="Atalhos da loja">
          <ul className="flex items-center gap-1">
            {iconNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    className="icon-link"
                    href={item.href}
                    aria-label={item.label}
                  >
                    <Icon className="size-[1.15rem]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <details className="group sm:hidden">
          <summary className="icon-link cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <MenuIcon className="size-5" />
            <span className="sr-only">Abrir menu</span>
          </summary>
          <div className="absolute inset-x-4 top-[4.65rem] rounded-3xl border border-brand/15 bg-surface p-5 shadow-[0_24px_70px_rgba(82,31,33,0.16)]">
            <nav aria-label="Navegação para celular">
              <ul className="grid gap-1">
                {navigation.map((item) => (
                  <li key={item.href}>
                    <Link
                      className="block rounded-xl px-3 py-3 text-base font-semibold text-ink hover:bg-sand/70 hover:text-brand"
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-ink/10 pt-4">
                {iconNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-[0.65rem] font-semibold text-ink/70 hover:bg-sand/70 hover:text-brand"
                      href={item.href}
                    >
                      <Icon className="size-5" />
                      {item.label.split(" ")[0]}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}

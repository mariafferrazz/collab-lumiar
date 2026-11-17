import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon, InstagramIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Sobre a Collab",
  description:
    "Conheça a proposta colaborativa da COLLAB e sua relação com Lumiar e Nova Friburgo.",
};

const values = [
  {
    number: "01",
    title: "Autoria visível",
    text: "Cada produto deve carregar o nome, a história e o processo de quem criou.",
  },
  {
    number: "02",
    title: "Território vivo",
    text: "A serra aparece como paisagem, matéria, repertório e rede de relações.",
  },
  {
    number: "03",
    title: "Colaboração justa",
    text: "A operação deve ser simples, transparente e respeitosa com todos os envolvidos.",
  },
];

export default function AboutPage() {
  return (
    <main id="conteudo">
      <section className="page-shell py-12 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="eyebrow">Sobre a Collab</p>
            <h1 className="mt-4 font-display text-6xl leading-[0.87] tracking-[-0.055em] text-ink sm:text-8xl">
              Criar junto muda a paisagem.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-ink/70">
              A COLLAB é uma loja coletiva em construção, pensada para aproximar
              artistas, produtores e pessoas que reconhecem valor no fazer
              local.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.8rem] bg-sand">
            <Image
              src="/images/hero-serra.webp"
              alt="Ateliê demonstrativo com vista para as montanhas de Nova Friburgo"
              fill
              loading="eager"
              sizes="(max-width: 1024px) 92vw, 54vw"
              className="object-cover object-[72%_center]"
            />
          </div>
        </div>
      </section>

      <section className="bg-brand py-16 text-cream sm:py-24">
        <div className="page-shell grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream/85">
              Nossa história
            </p>
            <p className="mt-5 text-sm leading-7 text-cream/65">
              Texto institucional demonstrativo — preparado para edição futura
              pelo painel administrativo.
            </p>
          </div>
          <div>
            <p className="font-display text-3xl leading-[1.25] text-cream sm:text-5xl">
              Em Lumiar e Nova Friburgo, diferentes técnicas convivem no mesmo
              território. A COLLAB quer tornar esses encontros visíveis e criar
              caminhos simples para que trabalhos autorais encontrem novas
              casas.
            </p>
            <p className="mt-8 max-w-2xl text-base leading-8 text-cream/70">
              A seleção futura reunirá objetos feitos em pequena escala, com
              contexto sobre materiais, processos e autoria. Nenhuma integração
              comercial está ativa nesta etapa.
            </p>
          </div>
        </div>
      </section>

      <section
        className="page-shell py-16 sm:py-24"
        aria-labelledby="values-title"
      >
        <p className="eyebrow">O que orienta a marca</p>
        <h2
          id="values-title"
          className="mt-3 font-display text-4xl text-ink sm:text-5xl"
        >
          Três ideias para seguir criando
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {values.map((value) => (
            <article
              key={value.number}
              className="rounded-[1.5rem] border border-brand/12 bg-surface/45 p-6"
            >
              <span className="text-xs font-bold text-brand">
                {value.number}
              </span>
              <h3 className="mt-8 font-display text-3xl text-ink">
                {value.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink/65">{value.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell grid gap-4 pb-16 sm:pb-24 md:grid-cols-3">
        <article
          id="contato"
          className="rounded-[1.5rem] border border-brand/10 bg-surface p-6"
        >
          <p className="eyebrow">Contato</p>
          <h2 className="mt-3 font-display text-3xl text-ink">
            Vamos conversar
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/65">
            O canal oficial de contato será publicado após a definição da
            operação. Nenhum endereço fictício é apresentado como real.
          </p>
        </article>
        <article
          id="redes"
          className="rounded-[1.5rem] border border-brand/10 bg-surface p-6"
        >
          <p className="eyebrow flex items-center gap-2">
            <InstagramIcon className="size-4" /> Redes
          </p>
          <h2 className="mt-3 font-display text-3xl text-ink">
            Diário da serra
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/65">
            A conexão oficial está preparada e aguarda a autorização da
            organizadora pela Meta. Até lá, a homepage não simula publicações.
          </p>
        </article>
        <article
          id="politicas"
          className="rounded-[1.5rem] border border-brand/10 bg-brand/8 p-6"
        >
          <p className="eyebrow">Políticas</p>
          <h2 className="mt-3 font-display text-3xl text-ink">
            Compra consciente
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/65">
            Trocas, entregas, privacidade e termos serão definidos antes da
            abertura comercial, sem textos jurídicos simulados.
          </p>
        </article>
      </section>

      <section className="page-shell rounded-[2rem] border border-brand/15 bg-surface px-6 py-12 text-center sm:px-12 sm:py-16">
        <p className="eyebrow">Explore a demonstração</p>
        <h2 className="mx-auto mt-3 max-w-3xl font-display text-4xl text-ink sm:text-5xl">
          Veja como artistas e produtos se encontram na COLLAB.
        </h2>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link className="button-primary" href="/artistas">
            Conhecer artistas
            <ArrowRightIcon className="size-4" />
          </Link>
          <Link className="button-secondary" href="/produtos">
            Explorar produtos
          </Link>
        </div>
      </section>
    </main>
  );
}

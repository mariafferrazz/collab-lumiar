import { ArrowRightIcon, InstagramIcon } from "@/components/ui/icons";
import { getLatestInstagramPosts } from "@/lib/server/instagram";
import type { InstagramFeedResult, InstagramPost } from "@/types/instagram";

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/lojacollablumiar/";

const publicationDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

type InstagramUnavailableStatus = Exclude<
  InstagramFeedResult["status"],
  "ready"
>;

const statusContent: Record<
  InstagramUnavailableStatus,
  { title: string; description: string }
> = {
  unconfigured: {
    title: "Conexão oficial em preparação",
    description:
      "A organizadora ainda precisa autorizar a conta pela Meta. Até lá, nenhuma publicação será simulada ou exibida como verdadeira.",
  },
  "token-expired": {
    title: "A autorização precisa ser renovada",
    description:
      "A conexão está temporariamente pausada até que a organizadora renove o acesso pelo fluxo oficial da Meta.",
  },
  error: {
    title: "Publicações temporariamente indisponíveis",
    description:
      "Não foi possível consultar a API oficial agora. O perfil da COLLAB continua disponível pelo botão abaixo.",
  },
  empty: {
    title: "Nenhuma publicação disponível",
    description:
      "A API oficial não retornou publicações para esta conta neste momento. Acompanhe o perfil para ver as novidades.",
  },
};

function InstagramProfileLink({ className = "" }: { className?: string }) {
  return (
    <a
      className={`button-primary ${className}`}
      href={INSTAGRAM_PROFILE_URL}
      target="_blank"
      rel="noreferrer"
    >
      Visitar @lojacollablumiar
      <ArrowRightIcon className="size-4" />
    </a>
  );
}

function InstagramPostCard({ post }: { post: InstagramPost }) {
  const caption = post.caption?.trim();
  const alt = caption
    ? `Publicação da COLLAB: ${caption}`
    : "Publicação oficial da COLLAB no Instagram";

  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-brand/12 bg-background shadow-[0_18px_50px_-36px_rgba(90,21,28,0.65)]">
      <a
        className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        href={post.permalink}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir publicação no Instagram"
      >
        <div className="relative aspect-square overflow-hidden bg-sand">
          {/* biome-ignore lint/performance/noImgElement: a API retorna URLs temporárias em hosts variáveis da CDN do Instagram. */}
          <img
            src={post.imageUrl}
            alt={alt}
            width={640}
            height={640}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
          {post.mediaType === "VIDEO" ? (
            <span className="absolute right-3 top-3 rounded-full bg-brand/90 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-cream">
              Vídeo
            </span>
          ) : null}
        </div>
        <div className="p-4">
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-ink/75">
            {caption || "Publicação oficial da COLLAB"}
          </p>
          <time
            className="mt-3 block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-brand/65"
            dateTime={post.publishedAt}
          >
            {publicationDateFormatter.format(new Date(post.publishedAt))}
          </time>
        </div>
      </a>
    </article>
  );
}

function InstagramStatusPanel({
  status,
}: {
  status: InstagramUnavailableStatus;
}) {
  const content = statusContent[status];

  return (
    <div className="mt-9 overflow-hidden rounded-[1.75rem] border border-brand/15 bg-background">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="px-6 py-10 sm:px-10 sm:py-12">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-brand text-cream"
          >
            <InstagramIcon className="size-5" />
          </span>
          <h3 className="mt-6 font-display text-3xl tracking-[-0.03em] text-ink sm:text-4xl">
            {content.title}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/65 sm:text-base">
            {content.description}
          </p>
          <InstagramProfileLink className="mt-7" />
        </div>
        <div className="flex min-h-64 items-end bg-brand px-6 py-8 text-cream">
          <p className="max-w-sm font-display text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
            Arte local, processos reais e novidades da serra.
          </p>
        </div>
      </div>
    </div>
  );
}

function InstagramSectionHeader() {
  return (
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <InstagramIcon className="size-4" />
          Perfil oficial
        </p>
        <h2
          id="instagram-title"
          className="mt-3 font-display text-4xl tracking-[-0.035em] text-ink sm:text-5xl"
        >
          Acompanhe a COLLAB
        </h2>
      </div>
      <p className="max-w-md text-sm leading-6 text-ink/60">
        As publicações aparecem somente quando a conta oficial está autorizada
        pela Meta.
      </p>
    </div>
  );
}

export function InstagramPreviewLoading() {
  return (
    <section
      className="bg-surface py-16 sm:py-24"
      aria-labelledby="instagram-title"
      aria-busy="true"
    >
      <div className="page-shell">
        <InstagramSectionHeader />
        <div
          className="mt-9 rounded-[1.75rem] border border-brand/15 bg-background px-6 py-12 text-sm text-ink/60 sm:px-10"
          role="status"
        >
          Consultando as publicações oficiais…
        </div>
      </div>
    </section>
  );
}

export async function InstagramPreview() {
  const feed = await getLatestInstagramPosts(6);

  return (
    <section
      className="bg-surface py-16 sm:py-24"
      aria-labelledby="instagram-title"
    >
      <div className="page-shell">
        <InstagramSectionHeader />

        {feed.status === "ready" ? (
          <>
            <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {feed.posts.map((post) => (
                <InstagramPostCard key={post.id} post={post} />
              ))}
            </div>
            <div className="mt-8 flex justify-start md:justify-end">
              <InstagramProfileLink />
            </div>
          </>
        ) : (
          <InstagramStatusPanel status={feed.status} />
        )}
      </div>
    </section>
  );
}

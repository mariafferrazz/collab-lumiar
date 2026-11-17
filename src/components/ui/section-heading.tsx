import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/icons";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: SectionHeadingProps) {
  return (
    <div className="mb-9 flex flex-col justify-between gap-5 border-b border-brand/20 pb-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-4xl leading-[0.95] tracking-[-0.035em] text-ink sm:text-5xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-4 max-w-xl text-base leading-7 text-ink/70">
            {description}
          </p>
        ) : null}
      </div>

      {href && linkLabel ? (
        <Link className="text-link shrink-0" href={href}>
          {linkLabel}
          <ArrowRightIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PREMIUM_META, PREMIUM_OVERLINE } from "@/components/ui/premium-styles";

type SectionHeaderProps = {
  overline: string;
  title: string;
  description?: string | null;
  ctaHref?: string;
  ctaLabel?: string;
};

export function SectionHeader({ overline, title, description, ctaHref, ctaLabel }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2.5">
        <p className={PREMIUM_OVERLINE}>{overline}</p>
        <h2 className="text-[1.125rem] font-semibold tracking-tight text-white/92 md:text-[1.25rem]">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-white/58">{description}</p> : null}
      </div>
      {ctaHref && ctaLabel ? (
        <Link className={`inline-flex items-center gap-2 text-sm font-medium transition hover:text-white/80 ${PREMIUM_META}`} href={ctaHref}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

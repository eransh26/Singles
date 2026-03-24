import Link from "next/link";
import { ArrowRight, CalendarDays, HeartHandshake, Sparkles, Stars } from "lucide-react";
import { HomeTrustBadge } from "./trust-badge";
import { PREMIUM_BODY, PREMIUM_META, PREMIUM_OVERLINE, PREMIUM_SURFACE, PREMIUM_TITLE } from "@/components/ui/premium-styles";

type SignalTone = "featured" | "event" | "buddy" | "community";

type HomeSignalCardProps = {
  tone: SignalTone;
  overline: string;
  title: string;
  body: string;
  trustTier?: "LOW" | "NORMAL" | "HIGH" | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  meta?: string | null;
  ctaHref?: string;
  ctaLabel?: string;
  compact?: boolean;
  children?: React.ReactNode;
};

const ICONS = {
  featured: Stars,
  event: CalendarDays,
  buddy: HeartHandshake,
  community: Sparkles,
} satisfies Record<SignalTone, React.ComponentType<{ className?: string }>>;

export function HomeSignalCard({ tone, overline, title, body, trustTier, emailVerified, phoneVerified, meta, ctaHref, ctaLabel, compact = false, children }: HomeSignalCardProps) {
  const Icon = ICONS[tone];
  const toneClasses =
    tone === "featured"
      ? "border-[rgba(189,151,100,0.12)] bg-[linear-gradient(180deg,rgba(74,49,30,0.16),rgba(26,22,21,0.72))]"
      : tone === "event"
        ? "border-[rgba(128,93,78,0.12)] bg-[linear-gradient(180deg,rgba(62,44,39,0.16),rgba(24,21,22,0.72))]"
        : tone === "buddy"
          ? "border-[rgba(127,87,95,0.12)] bg-[linear-gradient(180deg,rgba(63,34,44,0.14),rgba(24,21,24,0.72))]"
          : "border-[rgba(255,255,255,0.05)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(21,22,26,0.72))]";

  return (
    <article className={`${PREMIUM_SURFACE} ${toneClasses} p-4 hover:-translate-y-0.5 ${compact ? "" : "md:p-5"}`} data-testid="home-signal-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 ${PREMIUM_OVERLINE}`}>
              <Icon className="h-3.5 w-3.5" />
              {overline}
            </span>
            {trustTier ? <HomeTrustBadge compact emailVerified={emailVerified} phoneVerified={phoneVerified} tier={trustTier as never} /> : null}
          </div>
          <div className="space-y-2">
            <h3 className={PREMIUM_TITLE}>{title}</h3>
            <p className={PREMIUM_BODY}>{body}</p>
            {meta ? <p className={PREMIUM_META}>{meta}</p> : null}
          </div>
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      {ctaHref && ctaLabel ? (
        <div className="mt-4">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition duration-200 hover:text-white/86" href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}

import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
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
  kycVerified?: boolean;
  verificationStatus?: VerificationStatus | null;
  isBuddyApproved?: boolean;
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

export function HomeSignalCard({ tone, overline, title, body, trustTier, emailVerified, phoneVerified, kycVerified, verificationStatus, isBuddyApproved, meta, ctaHref, ctaLabel, compact = false, children }: HomeSignalCardProps) {
  const Icon = ICONS[tone];
  const toneClasses =
    tone === "featured"
      ? "border-[rgba(189,151,100,0.1)] bg-[linear-gradient(180deg,rgba(74,49,30,0.13),rgba(37,30,27,0.82))]"
      : tone === "event"
        ? "border-[rgba(128,93,78,0.1)] bg-[linear-gradient(180deg,rgba(62,44,39,0.13),rgba(33,29,28,0.82))]"
        : tone === "buddy"
          ? "border-[rgba(127,87,95,0.1)] bg-[linear-gradient(180deg,rgba(63,34,44,0.11),rgba(35,30,31,0.82))]"
          : "border-[rgba(255,255,255,0.045)] bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(35,31,29,0.82))]";

  return (
    <article className={`${PREMIUM_SURFACE} ${toneClasses} p-4 hover:-translate-y-0.5 ${compact ? "" : "md:p-5"}`} data-testid="home-signal-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 ${PREMIUM_OVERLINE}`}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.02)] text-[color:var(--lux-text-accent)]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              {overline}
            </span>
            {trustTier ? (
              <HomeTrustBadge compact emailVerified={emailVerified} isBuddyApproved={isBuddyApproved} kycVerified={kycVerified} phoneVerified={phoneVerified} tier={trustTier as never} verificationStatus={verificationStatus} />
            ) : null}
          </div>
          <div className="space-y-2.5">
            <h3 className={PREMIUM_TITLE}>{title}</h3>
            <p className={PREMIUM_BODY}>{body}</p>
            {meta ? <p className={`${PREMIUM_META} normal-case tracking-[0.04em] text-white/44`}>{meta}</p> : null}
          </div>
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      {ctaHref && ctaLabel ? (
        <div className="mt-4">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-white/68 transition duration-200 hover:text-white/82" href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}

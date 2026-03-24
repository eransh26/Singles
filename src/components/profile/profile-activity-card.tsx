import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { PREMIUM_BODY, PREMIUM_META, PREMIUM_SURFACE } from "@/components/ui/premium-styles";

type ProfileActivityCardProps = {
  href: string;
  title: string;
  body: string;
  meta: string;
  createdAt: string;
  trustTier: "LOW" | "NORMAL" | "HIGH" | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  countsLabel: string;
};

export function ProfileActivityCard({ href, title, body, meta, createdAt, trustTier, emailVerified = false, phoneVerified = false, countsLabel }: ProfileActivityCardProps) {
  return (
    <Link className={`block ${PREMIUM_SURFACE} p-4 hover:-translate-y-0.5 hover:border-[rgba(195,145,88,0.18)]`} data-testid="profile-activity-card" href={href}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={PREMIUM_META}>{title}</span>
        <HomeTrustBadge compact emailVerified={emailVerified} phoneVerified={phoneVerified} tier={trustTier as never} />
      </div>
      <p className={`mt-3 line-clamp-3 ${PREMIUM_BODY}`}>{body}</p>
      <div className={`mt-4 flex flex-wrap items-center gap-2 ${PREMIUM_META}`}>
        <span>{meta}</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <RelativeTime className="tracking-[0.08em] text-white/42" value={createdAt} />
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>{countsLabel}</span>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { ArrowRight } from "lucide-react";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { ContextChips } from "@/components/discovery/context-chips";
import { PREMIUM_BODY, PREMIUM_META, PREMIUM_SURFACE, PREMIUM_TITLE } from "@/components/ui/premium-styles";

type DiscoveryMemberCardProps = {
  href: string;
  title: string;
  subtitle: string;
  body: string;
  imageUrl?: string | null;
  initial: string;
  trustTier: "LOW" | "NORMAL" | "HIGH" | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  kycVerified?: boolean;
  verificationStatus?: VerificationStatus | null;
  isBuddyApproved?: boolean;
  chips: string[];
  meta?: string | null;
};

export function DiscoveryMemberCard({ href, title, subtitle, body, imageUrl, initial, trustTier, emailVerified = false, phoneVerified = false, kycVerified = false, verificationStatus = null, isBuddyApproved = false, chips, meta }: DiscoveryMemberCardProps) {
  return (
    <article className={`${PREMIUM_SURFACE} p-4 hover:-translate-y-0.5 hover:border-[rgba(195,145,88,0.18)]`} data-testid="explore-member-card">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-sm font-semibold text-white/88">
          {imageUrl ? <img alt={`${title} profile`} className="h-full w-full object-cover" src={imageUrl} /> : initial}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className={`truncate ${PREMIUM_TITLE}`}>{title}</h3>
            <HomeTrustBadge compact emailVerified={emailVerified} isBuddyApproved={isBuddyApproved} kycVerified={kycVerified} phoneVerified={phoneVerified} tier={trustTier as never} verificationStatus={verificationStatus} />
          </div>
          <p className={PREMIUM_META}>{subtitle}</p>
          <p className={PREMIUM_BODY}>{body}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ContextChips chips={chips} />
        {meta ? <p className={PREMIUM_META}>{meta}</p> : null}
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-white/84 transition duration-200 hover:text-white" href={href}>
          View
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

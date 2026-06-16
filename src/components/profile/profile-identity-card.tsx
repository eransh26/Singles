import { VerificationStatus } from "@prisma/client";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { ContextChips } from "@/components/discovery/context-chips";
import { PREMIUM_BODY, PREMIUM_SURFACE_STRONG } from "@/components/ui/premium-styles";

type ProfileIdentityCardProps = {
  name: string;
  summary: string;
  imageUrl?: string | null;
  initial: string;
  trustTier: "LOW" | "NORMAL" | "HIGH" | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  kycVerified?: boolean;
  verificationStatus?: VerificationStatus | null;
  isBuddyApproved?: boolean;
  chips: string[];
  children?: React.ReactNode;
  animateTrustBadgesForUserId?: string | null;
  showTrustActivationCopy?: boolean;
};

export function ProfileIdentityCard({
  name,
  summary,
  imageUrl,
  initial,
  trustTier,
  emailVerified = false,
  phoneVerified = false,
  kycVerified = false,
  verificationStatus = null,
  isBuddyApproved = false,
  chips,
  children,
  animateTrustBadgesForUserId,
  showTrustActivationCopy = false,
}: ProfileIdentityCardProps) {
  return (
    <section className={`${PREMIUM_SURFACE_STRONG} bg-[radial-gradient(circle_at_top_left,rgba(189,151,100,0.09),transparent_24%),linear-gradient(180deg,rgba(65,53,46,0.92)_0%,rgba(45,37,33,0.96)_100%)] p-5 md:p-6`} data-testid="profile-identity-card">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="relative h-[104px] w-[104px] flex-none">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[color:var(--ev-line-2)] bg-[image:var(--ev-avatar)] text-2xl font-semibold text-[color:var(--ev-text)] shadow-[0_10px_24px_rgba(18,12,9,0.2)]">
              {imageUrl ? <img alt={`${name} profile`} className="h-full w-full object-cover" src={imageUrl} /> : initial}
            </div>
            <span className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--ev-bg-0)] bg-[color:var(--ev-sage)]" />
          </div>
          <div className="min-w-0 space-y-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="ev-display text-[1.9rem] font-medium tracking-tight text-[color:var(--ev-text)] md:text-[2.15rem]">{name}</h1>
              <HomeTrustBadge
                animateNewForUserId={animateTrustBadgesForUserId}
                emailVerified={emailVerified}
                isBuddyApproved={isBuddyApproved}
                kycVerified={kycVerified}
                phoneVerified={phoneVerified}
                showActivationCopy={showTrustActivationCopy}
                tier={trustTier as never}
                verificationStatus={verificationStatus}
              />
            </div>
            <p className={`${PREMIUM_BODY} max-w-2xl md:text-[15px] md:leading-7`}>{summary}</p>
            <ContextChips chips={chips} testId="profile-context-chips" />
          </div>
        </div>
        {children ? <div className="w-full max-w-[22rem] shrink-0">{children}</div> : null}
      </div>
    </section>
  );
}

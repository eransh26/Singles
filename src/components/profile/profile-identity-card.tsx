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
          <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-[1.35rem] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top,rgba(212,176,123,0.14),rgba(255,255,255,0.03)_68%)] text-xl font-semibold text-white/88 shadow-[0_10px_24px_rgba(18,12,9,0.08)] md:h-24 md:w-24">
            {imageUrl ? <img alt={`${name} profile`} className="h-full w-full object-cover" src={imageUrl} /> : initial}
          </div>
          <div className="min-w-0 space-y-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[1.85rem] font-semibold tracking-tight text-white/92 md:text-[2.15rem]">{name}</h1>
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

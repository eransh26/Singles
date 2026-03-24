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
  chips: string[];
  children?: React.ReactNode;
};

export function ProfileIdentityCard({ name, summary, imageUrl, initial, trustTier, emailVerified = false, phoneVerified = false, chips, children }: ProfileIdentityCardProps) {
  return (
    <section className={`${PREMIUM_SURFACE_STRONG} bg-[radial-gradient(circle_at_top,rgba(94,67,60,0.14),transparent_28%),linear-gradient(180deg,#17181c_0%,#111218_100%)] p-5 md:p-6`} data-testid="profile-identity-card">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-xl font-semibold text-white/88 md:h-24 md:w-24">
            {imageUrl ? <img alt={`${name} profile`} className="h-full w-full object-cover" src={imageUrl} /> : initial}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[1.85rem] font-semibold tracking-tight text-white md:text-[2.15rem]">{name}</h1>
              <HomeTrustBadge emailVerified={emailVerified} phoneVerified={phoneVerified} tier={trustTier as never} />
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

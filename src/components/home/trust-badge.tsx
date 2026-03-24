import { InternalTrustTier } from "@prisma/client";

type HomeTrustBadgeProps = {
  tier: InternalTrustTier | null | undefined;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  compact?: boolean;
};

function resolveTrustCopy(tier: InternalTrustTier | null | undefined, emailVerified?: boolean, phoneVerified?: boolean) {
  if (tier === InternalTrustTier.HIGH) {
    return { label: "High trust", tone: "high" as const };
  }

  if (emailVerified && phoneVerified) {
    return { label: "Verified", tone: "verified" as const };
  }

  if (tier === InternalTrustTier.NORMAL) {
    return { label: "Trusted", tone: "normal" as const };
  }

  return { label: "New", tone: "new" as const };
}

export function HomeTrustBadge({ tier, emailVerified = false, phoneVerified = false, compact = false }: HomeTrustBadgeProps) {
  const trust = resolveTrustCopy(tier, emailVerified, phoneVerified);

  const toneClasses =
    trust.tone === "high"
      ? "border-[rgba(229,181,98,0.26)] bg-[rgba(229,181,98,0.12)] text-[#f1ddb2]"
      : trust.tone === "verified"
        ? "border-[rgba(168,190,162,0.26)] bg-[rgba(168,190,162,0.12)] text-[#d9e5d4]"
        : trust.tone === "normal"
          ? "border-[rgba(177,136,116,0.22)] bg-[rgba(177,136,116,0.1)] text-[#e6cdbf]"
          : "border-[rgba(127,120,126,0.24)] bg-[rgba(127,120,126,0.1)] text-[#d1c9cf]";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium uppercase tracking-[0.16em] ${compact ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-[11px]"} ${toneClasses}`}
      data-testid="home-trust-badge"
    >
      {trust.label}
    </span>
  );
}

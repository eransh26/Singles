"use client";

import { InternalTrustTier, VerificationStatus } from "@prisma/client";
import { Check, HeartHandshake } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";
import {
  TRUST_BADGE_KINDS,
  type TrustBadgeKind,
  getUserTrustBadgeKinds,
} from "@/lib/trust-ladder";

type UserTrustBadgesProps = {
  tier?: InternalTrustTier | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  phoneVerifiedAt?: Date | string | null;
  kycVerified?: boolean;
  ageVerified?: boolean;
  verificationStatus?: VerificationStatus | null;
  isBuddyApproved?: boolean;
  compact?: boolean;
  className?: string;
  animateNewForUserId?: string | null;
  showActivationCopy?: boolean;
};

export type HomeTrustBadgeProps = UserTrustBadgesProps;

type BadgeDefinition = {
  label: string;
  tooltip: string;
  activationCopy: string;
  icon: typeof Check;
  badgeClassName: string;
  glowClassName: string;
};

const BADGE_DEFINITIONS: Record<TrustBadgeKind, BadgeDefinition> = {
  [TRUST_BADGE_KINDS.CONNECTED]: {
    label: "Connected",
    tooltip: "Email or phone verified",
    activationCopy: "Your contact info is now confirmed",
    icon: Check,
    badgeClassName:
      "text-white/70 border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)]",
    glowClassName: "trust-badge-glow-connected",
  },
  [TRUST_BADGE_KINDS.VERIFIED]: {
    label: "Verified",
    tooltip: "Identity verified",
    activationCopy: "You're now verified",
    icon: Check,
    badgeClassName:
      "text-[color:var(--lux-text-accent)] border-[rgba(212,176,123,0.2)] bg-[rgba(212,176,123,0.11)]",
    glowClassName: "trust-badge-glow-verified",
  },
  [TRUST_BADGE_KINDS.BUDDY]: {
    label: "Buddy",
    tooltip: "Available to support others",
    activationCopy: "You're now a Buddy",
    icon: HeartHandshake,
    badgeClassName:
      "text-[rgba(198,173,255,0.92)] border-[rgba(160,122,255,0.18)] bg-[rgba(120,87,170,0.16)]",
    glowClassName: "trust-badge-glow-buddy",
  },
};

function getStorageKey(userId: string) {
  return `evyta:seen-trust-badges:${userId}`;
}

function readSeenBadges(userId: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const stored = window.localStorage.getItem(getStorageKey(userId));
    if (!stored) {
      return new Set<string>();
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? new Set(parsed.filter((value): value is string => typeof value === "string")) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function writeSeenBadges(userId: string, badges: TrustBadgeKind[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(badges));
}

function normalisePhoneVerifiedAt(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function UserTrustBadges({
  emailVerified = false,
  phoneVerified = false,
  phoneVerifiedAt = null,
  kycVerified = false,
  ageVerified = false,
  verificationStatus = null,
  isBuddyApproved = false,
  compact = false,
  className,
  animateNewForUserId,
  showActivationCopy = false,
}: UserTrustBadgesProps) {
  const badges = useMemo(
    () =>
      getUserTrustBadgeKinds({
        emailVerified: emailVerified ? new Date() : null,
        phoneVerified,
        phoneVerifiedAt: normalisePhoneVerifiedAt(phoneVerifiedAt),
        kycVerified,
        ageVerified,
        verificationStatus,
        isBuddyApproved,
      }),
    [ageVerified, emailVerified, isBuddyApproved, kycVerified, phoneVerified, phoneVerifiedAt, verificationStatus],
  );

  const [hoveredKind, setHoveredKind] = useState<TrustBadgeKind | null>(null);
  const [pinnedKind, setPinnedKind] = useState<TrustBadgeKind | null>(null);
  const [animatedKinds, setAnimatedKinds] = useState<TrustBadgeKind[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef<HTMLButtonElement>(null);
  const verifiedRef = useRef<HTMLButtonElement>(null);
  const buddyRef = useRef<HTMLButtonElement>(null);

  const restoreFocusRef =
    pinnedKind === TRUST_BADGE_KINDS.CONNECTED
      ? connectedRef
      : pinnedKind === TRUST_BADGE_KINDS.VERIFIED
        ? verifiedRef
        : pinnedKind === TRUST_BADGE_KINDS.BUDDY
          ? buddyRef
          : undefined;

  useDismissibleLayer({
    open: Boolean(pinnedKind),
    onDismiss: () => setPinnedKind(null),
    refs: [containerRef],
    restoreFocusRef,
  });

  useEffect(() => {
    if (!animateNewForUserId || badges.length === 0 || typeof window === "undefined") {
      return;
    }

    const seenBadges = readSeenBadges(animateNewForUserId);
    const newlyEarned = badges.filter((badge) => !seenBadges.has(badge));

    if (newlyEarned.length > 0) {
      setAnimatedKinds(newlyEarned);
      writeSeenBadges(animateNewForUserId, badges);
      const timeout = window.setTimeout(() => setAnimatedKinds([]), 1200);
      return () => window.clearTimeout(timeout);
    }

    writeSeenBadges(animateNewForUserId, badges);
    return undefined;
  }, [animateNewForUserId, badges]);

  const activeKind = pinnedKind ?? hoveredKind;
  const activationKind = animatedKinds[0] ?? null;
  const sizeClassName = compact ? "h-4 w-4" : "h-5 w-5";
  const iconClassName = compact ? "h-[0.6rem] w-[0.6rem]" : "h-[0.72rem] w-[0.72rem]";

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className ?? ""}`.trim()} data-testid="home-trust-badge" ref={containerRef}>
      {badges.map((kind) => {
        const definition = BADGE_DEFINITIONS[kind];
        const Icon = definition.icon;
        const buttonRef =
          kind === TRUST_BADGE_KINDS.CONNECTED
            ? connectedRef
            : kind === TRUST_BADGE_KINDS.VERIFIED
              ? verifiedRef
              : buddyRef;
        const isAnimated = animatedKinds.includes(kind);

        return (
          <button
            aria-label={`${definition.label}: ${definition.tooltip}`}
            className={[
              "relative inline-flex shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition duration-200 hover:border-[rgba(255,255,255,0.12)] focus-visible:ring-2 focus-visible:ring-[rgba(212,176,123,0.25)] focus-visible:ring-offset-0",
              sizeClassName,
              definition.badgeClassName,
              isAnimated ? `motion-safe:trust-badge-activate ${definition.glowClassName}` : "",
            ].join(" ")}
            data-testid={`trust-badge-${kind}`}
            key={kind}
            onBlur={() => {
              if (!pinnedKind) {
                setHoveredKind(null);
              }
            }}
            onClick={() => setPinnedKind((current) => (current === kind ? null : kind))}
            onFocus={() => setHoveredKind(kind)}
            onMouseEnter={() => setHoveredKind(kind)}
            onMouseLeave={() => setHoveredKind((current) => (current === kind ? null : current))}
            ref={buttonRef}
            title={definition.tooltip}
            type="button"
          >
            <Icon aria-hidden="true" className={iconClassName} strokeWidth={2.15} />
            <span className="sr-only">{definition.label}</span>
          </button>
        );
      })}

      {activeKind ? (
        <div
          className="absolute left-0 top-[calc(100%+0.45rem)] z-30 whitespace-nowrap rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(42,34,30,0.96)] px-3 py-1.5 text-[11px] font-medium text-white/78 shadow-[0_10px_24px_rgba(20,14,11,0.16)] backdrop-blur-md"
          role="tooltip"
        >
          {BADGE_DEFINITIONS[activeKind].tooltip}
        </div>
      ) : null}

      {showActivationCopy && activationKind ? (
        <div className="absolute left-0 top-[calc(100%+1.95rem)] z-20 text-[11px] font-medium text-white/62 motion-safe:animate-[trustBadgeFade_360ms_ease-out]">
          {BADGE_DEFINITIONS[activationKind].activationCopy}
        </div>
      ) : null}
    </div>
  );
}

export function HomeTrustBadge(props: HomeTrustBadgeProps) {
  return <UserTrustBadges {...props} />;
}



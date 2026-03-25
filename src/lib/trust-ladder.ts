import { VerificationStatus } from "@prisma/client";

export const TRUST_LADDER_LEVELS = {
  UNVERIFIED: "UNVERIFIED",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  PHONE_VERIFIED: "PHONE_VERIFIED",
  KYC_VERIFIED: "KYC_VERIFIED",
} as const;

export const TRUST_BADGE_KINDS = {
  VERIFIED: "verified",
  BUDDY: "buddy",
  CONNECTED: "connected",
} as const;

export type TrustLadderLevel = (typeof TRUST_LADDER_LEVELS)[keyof typeof TRUST_LADDER_LEVELS];
export type TrustBadgeKind = (typeof TRUST_BADGE_KINDS)[keyof typeof TRUST_BADGE_KINDS];

export type TrustLadderUser = {
  emailVerified: Date | null;
  phoneVerified?: boolean | null;
  phoneVerifiedAt?: Date | null;
  kycVerified?: boolean | null;
  ageVerified?: boolean | null;
  verificationStatus?: VerificationStatus | null;
  isBuddyApproved?: boolean | null;
  buddyProfile?: {
    domains?: Array<unknown>;
  } | null;
};

export function isConnectedVerifiedUser(user: TrustLadderUser) {
  return Boolean(user.emailVerified || user.phoneVerified || user.phoneVerifiedAt);
}

export function isIdentityVerifiedUser(user: TrustLadderUser) {
  const hasApprovedVerification = String(user.verificationStatus ?? "") === "APPROVED";
  return Boolean(user.kycVerified || hasApprovedVerification || user.ageVerified);
}

export function canUserHoldBuddyRole(user: TrustLadderUser) {
  return isConnectedVerifiedUser(user) && isIdentityVerifiedUser(user);
}

export function isBuddyApprovedUser(user: TrustLadderUser) {
  const hasBuddyApproval = Boolean(user.isBuddyApproved || user.buddyProfile?.domains?.length);
  return hasBuddyApproval && canUserHoldBuddyRole(user);
}

export function getUserTrustBadgeKinds(user: TrustLadderUser): TrustBadgeKind[] {
  const badges: TrustBadgeKind[] = [];

  if (isIdentityVerifiedUser(user)) {
    badges.push(TRUST_BADGE_KINDS.VERIFIED);
  }

  if (isBuddyApprovedUser(user)) {
    badges.push(TRUST_BADGE_KINDS.BUDDY);
  }

  if (isConnectedVerifiedUser(user)) {
    badges.push(TRUST_BADGE_KINDS.CONNECTED);
  }

  return badges;
}

export function getTrustLadderLevel(user: TrustLadderUser): TrustLadderLevel {
  if (!user.emailVerified) {
    return TRUST_LADDER_LEVELS.UNVERIFIED;
  }

  if (user.kycVerified) {
    return TRUST_LADDER_LEVELS.KYC_VERIFIED;
  }

  if (user.phoneVerified || user.phoneVerifiedAt) {
    return TRUST_LADDER_LEVELS.PHONE_VERIFIED;
  }

  return TRUST_LADDER_LEVELS.EMAIL_VERIFIED;
}

export function getTrustBadgeCopy(level: TrustLadderLevel) {
  switch (level) {
    case TRUST_LADDER_LEVELS.KYC_VERIFIED:
      return { label: "Trusted", tone: "trusted" as const };
    case TRUST_LADDER_LEVELS.PHONE_VERIFIED:
      return { label: "Verified+", tone: "plus" as const };
    case TRUST_LADDER_LEVELS.EMAIL_VERIFIED:
      return { label: "Verified", tone: "verified" as const };
    default:
      return { label: "New", tone: "new" as const };
  }
}

export function getTrustPromptCopy(level: TrustLadderLevel, action: "chat" | "video" | "buddy") {
  if (action === "chat" && level === TRUST_LADDER_LEVELS.EMAIL_VERIFIED) {
    return "Verify your phone to reach more people.";
  }

  if ((action === "video" || action === "buddy") && level !== TRUST_LADDER_LEVELS.KYC_VERIFIED) {
    return "This requires higher trust.";
  }

  return null;
}


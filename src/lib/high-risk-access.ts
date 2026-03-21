import { AccountStatus, InternalTrustTier, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { refreshUserTrustStates } from "@/lib/internal-trust";

export const HIGH_RISK_ACTIONS = {
  VIDEO_REQUEST: "VIDEO_REQUEST",
  FEATURED_REQUEST: "FEATURED_REQUEST",
  BUDDY_ELIGIBILITY: "BUDDY_ELIGIBILITY",
} as const;

export type HighRiskAction = (typeof HIGH_RISK_ACTIONS)[keyof typeof HIGH_RISK_ACTIONS];

type TrustDbClient = Prisma.TransactionClient | typeof prisma;

export type HighRiskAccessState = {
  allowed: boolean;
  action: HighRiskAction;
  trustTier: InternalTrustTier | null;
  minimumTier: InternalTrustTier;
  reason: string | null;
  nextStep: string | null;
};

const ACTION_MESSAGES: Record<HighRiskAction, { reason: string; nextStep: string }> = {
  VIDEO_REQUEST: {
    reason: "Complete more trust requirements before using video.",
    nextStep: "Verify your account details and build more healthy activity first.",
  },
  FEATURED_REQUEST: {
    reason: "Complete more trust requirements before contacting the featured member.",
    nextStep: "Verify your account details and build more healthy activity first.",
  },
  BUDDY_ELIGIBILITY: {
    reason: "Buddy applications require more established trust first.",
    nextStep: "Complete verification and build more healthy activity before applying.",
  },
};

export async function getHighRiskAccessState(
  db: TrustDbClient,
  userId: string,
  action: HighRiskAction,
): Promise<HighRiskAccessState> {
  await refreshUserTrustStates(db, [userId]);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true, trustTier: true },
  });

  const minimumTier = InternalTrustTier.NORMAL;

  if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
    return {
      allowed: false,
      action,
      trustTier: user?.trustTier ?? null,
      minimumTier,
      reason: "This action is not available right now.",
      nextStep: null,
    };
  }

  if (user.trustTier === InternalTrustTier.LOW) {
    return {
      allowed: false,
      action,
      trustTier: user.trustTier,
      minimumTier,
      reason: ACTION_MESSAGES[action].reason,
      nextStep: ACTION_MESSAGES[action].nextStep,
    };
  }

  return {
    allowed: true,
    action,
    trustTier: user.trustTier,
    minimumTier,
    reason: null,
    nextStep: null,
  };
}

export async function assertHighRiskAccess(db: TrustDbClient, userId: string, action: HighRiskAction) {
  const access = await getHighRiskAccessState(db, userId, action);
  if (!access.allowed) {
    throw new Error(access.nextStep ? `${access.reason} ${access.nextStep}` : access.reason ?? "This action is not available right now.");
  }
  return access;
}

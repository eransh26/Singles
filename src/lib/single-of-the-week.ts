import {
  AccountStatus,
  ChatRequestOriginType,
  ChatRequestStatus,
  ConversationStatus,
  InternalTrustTier,
  Prisma,
  ReportStatus,
  SingleOfWeekApplicationStatus,
  SingleOfWeekFeatureStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { refreshUserTrustStates } from "@/lib/internal-trust";
import { trustScoreMeetsThreshold } from "@/lib/trust-score";
import { getHighRiskAccessState, HIGH_RISK_ACTIONS } from "@/lib/high-risk-access";
import { createNotificationWithDelivery } from "@/lib/notifications";

export const SINGLE_OF_WEEK_BIO_MAX = 300;
export const SINGLE_OF_WEEK_TEXT_MAX = 300;
export const SINGLE_OF_WEEK_MAX_PHOTOS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
export const SINGLE_OF_WEEK_MIN_TRUST_SCORE = 60;

export function isSingleOfWeekVerifiedUser(user: { emailVerified: Date | null; phoneVerifiedAt: Date | null }) {
  return Boolean(user.emailVerified && user.phoneVerifiedAt);
}

export function normalizeWeekOf(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function getWeekOfForDate(value: Date) {
  const normalized = normalizeWeekOf(value);
  const day = normalized.getUTCDay();
  normalized.setUTCDate(normalized.getUTCDate() - day);
  return normalized;
}

export function getUpcomingSunday(value = new Date()) {
  const normalized = normalizeWeekOf(value);
  const day = normalized.getUTCDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  normalized.setUTCDate(normalized.getUTCDate() + daysUntilSunday);
  return normalized;
}

export function getSingleOfWeekPublishAt(weekOf: Date) {
  return new Date(Date.UTC(weekOf.getUTCFullYear(), weekOf.getUTCMonth(), weekOf.getUTCDate(), 0, 0, 0));
}

export function getSingleOfWeekNotifyAt(weekOf: Date) {
  return new Date(getSingleOfWeekPublishAt(weekOf).getTime() - 2 * DAY_MS);
}

export function getEditWindowDeadline(weekOf: Date) {
  return new Date(getSingleOfWeekPublishAt(weekOf).getTime() - DAY_MS);
}

export async function ensureSingleOfWeekConfig(db: Prisma.TransactionClient | typeof prisma = prisma) {
  return db.singleOfWeekConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      targetDailyCap: 10,
      targetWeeklyCap: 20,
      targetMonthlyCap: 50,
      requesterDailyCap: 3,
      requesterWeeklyCap: 6,
      requesterMonthlyCap: 12,
    },
  });
}

export async function hasOpenReportAgainstUser(db: Prisma.TransactionClient | typeof prisma, userId: string) {
  const report = await db.report.findFirst({
    where: {
      targetUserId: userId,
      status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] },
    },
    select: { id: true },
  });

  return Boolean(report);
}

export async function hasAnyUserBlock(db: Prisma.TransactionClient | typeof prisma, userId: string) {
  const block = await db.userBlock.findFirst({
    where: {
      OR: [{ blockerUserId: userId }, { blockedUserId: userId }],
    },
    select: { id: true },
  });

  return Boolean(block);
}

export async function hasPairBlock(db: Prisma.TransactionClient | typeof prisma, userId: string, targetUserId: string) {
  const block = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userId, blockedUserId: targetUserId },
        { blockerUserId: targetUserId, blockedUserId: userId },
      ],
    },
    select: { id: true },
  });

  return Boolean(block);
}

export async function hasTrustedConversation(db: Prisma.TransactionClient | typeof prisma, userId: string) {
  const conversation = await db.conversation.findFirst({
    where: {
      kind: "MEMBER_CHAT",
      status: ConversationStatus.ACTIVE,
      OR: [{ userOneId: userId }, { userTwoId: userId }],
    },
    select: { id: true },
  });

  return Boolean(conversation);
}

export async function canApplyForSingleOfWeek(db: Prisma.TransactionClient | typeof prisma, userId: string) {
  await refreshUserTrustStates(db, [userId]);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountStatus: true,
      emailVerified: true,
      phoneVerifiedAt: true,
      trustScore: true,
    },
  });

  if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
    return { allowed: false, reason: "Your account is not active." };
  }

  if (!isSingleOfWeekVerifiedUser(user)) {
    return { allowed: false, reason: "Complete email and phone verification before applying." };
  }

  if (!trustScoreMeetsThreshold(user.trustScore, SINGLE_OF_WEEK_MIN_TRUST_SCORE)) {
    return { allowed: false, reason: "Healthy activity improves access over time before Single of the Week opens." };
  }

  if (await hasAnyUserBlock(db, userId)) {
    return { allowed: false, reason: "Single of the Week applications are not available while block restrictions are active." };
  }

  if (await hasOpenReportAgainstUser(db, userId)) {
    return { allowed: false, reason: "Single of the Week applications are paused while a report is under review." };
  }

  return { allowed: true as const, reason: null };
}

export async function isTrustedSingleOfWeekRequester(db: Prisma.TransactionClient | typeof prisma, requesterUserId: string, featuredUserId: string) {
  const trustAccess = await getHighRiskAccessState(db, requesterUserId, HIGH_RISK_ACTIONS.FEATURED_REQUEST);
  if (!trustAccess.allowed) {
    return false;
  }
  const requester = await db.user.findUnique({
    where: { id: requesterUserId },
    select: {
      id: true,
      accountStatus: true,
      emailVerified: true,
      phoneVerifiedAt: true,
    },
  });

  if (!requester || requester.accountStatus !== AccountStatus.ACTIVE || !isSingleOfWeekVerifiedUser(requester)) {
    return false;
  }

  if (await hasPairBlock(db, requesterUserId, featuredUserId)) {
    return false;
  }

  if (await hasOpenReportAgainstUser(db, requesterUserId)) {
    return false;
  }

  if (!(await hasTrustedConversation(db, requesterUserId))) {
    return false;
  }

  return true;
}

export async function syncSingleOfWeekState(now = new Date()) {
  const feature = await prisma.singleOfWeekFeature.findFirst({
    where: {
      status: {
        in: [SingleOfWeekFeatureStatus.UPCOMING, SingleOfWeekFeatureStatus.AWAITING_RESPONSE, SingleOfWeekFeatureStatus.ACTIVE],
      },
    },
    orderBy: { publishAt: "asc" },
    select: {
      id: true,
      publishAt: true,
      notifyAt: true,
      status: true,
      notifiedAt: true,
      application: {
        select: {
          applicantUserId: true,
          applicant: { select: { displayName: true } },
        },
      },
    },
  });

  if (!feature) {
    return null;
  }

  const updates: Prisma.SingleOfWeekFeatureUpdateInput = {};

  if ((feature.status === SingleOfWeekFeatureStatus.UPCOMING || feature.status === SingleOfWeekFeatureStatus.AWAITING_RESPONSE) && feature.publishAt <= now && feature.notifiedAt) {
    const refreshed = await prisma.singleOfWeekFeature.findUnique({ where: { id: feature.id }, select: { acceptedAt: true } });
    if (refreshed?.acceptedAt) {
      updates.status = SingleOfWeekFeatureStatus.ACTIVE;
    }
  } else if (feature.status === SingleOfWeekFeatureStatus.UPCOMING && feature.notifyAt <= now) {
    updates.status = SingleOfWeekFeatureStatus.AWAITING_RESPONSE;
  }

  if (!feature.notifiedAt && feature.notifyAt <= now) {
    updates.notifiedAt = now;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.singleOfWeekFeature.update({
      where: { id: feature.id },
      data: updates,
    });

    if (!feature.notifiedAt && feature.notifyAt <= now) {
      await createNotificationWithDelivery(feature.application.applicantUserId, "SYSTEM", {
        kind: "single_of_week_selected",
        title: "Single of the Week selection",
        path: "/settings#single-of-week",
      });
    }
  }

  await prisma.singleOfWeekFeature.updateMany({
    where: {
      status: SingleOfWeekFeatureStatus.ACTIVE,
      publishAt: { lt: new Date(now.getTime() - 7 * DAY_MS) },
    },
    data: {
      status: SingleOfWeekFeatureStatus.COMPLETED,
      completedAt: now,
    },
  });

  return prisma.singleOfWeekFeature.findFirst({
    where: {
      status: { in: [SingleOfWeekFeatureStatus.AWAITING_RESPONSE, SingleOfWeekFeatureStatus.ACTIVE] },
    },
    orderBy: { publishAt: "asc" },
    include: {
      application: {
        include: {
          applicant: true,
          photos: { orderBy: { sortOrder: "asc" } },
        },
      },
      requestLimitOverride: true,
    },
  });
}

export async function activateAcceptedFeatureIfDue(featureId: string, now = new Date()) {
  const feature = await prisma.singleOfWeekFeature.findUnique({
    where: { id: featureId },
    select: { id: true, status: true, publishAt: true, acceptedAt: true },
  });

  if (feature && feature.acceptedAt && feature.publishAt <= now && feature.status !== SingleOfWeekFeatureStatus.ACTIVE) {
    await prisma.singleOfWeekFeature.update({
      where: { id: feature.id },
      data: { status: SingleOfWeekFeatureStatus.ACTIVE },
    });
  }
}

export function getSingleOfWeekCountsWindow(now = new Date()) {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekOf = getWeekOfForDate(now);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { startOfDay, weekOf, startOfMonth };
}

export async function getSingleOfWeekEffectiveTargetCaps(featureId: string) {
  const [config, override] = await Promise.all([
    ensureSingleOfWeekConfig(),
    prisma.singleOfWeekFeatureLimitOverride.findUnique({ where: { featureId } }),
  ]);

  return {
    dailyCap: override?.dailyCap ?? config.targetDailyCap,
    weeklyCap: override?.weeklyCap ?? config.targetWeeklyCap,
    monthlyCap: override?.monthlyCap ?? config.targetMonthlyCap,
  };
}

export async function getSingleOfWeekRequesterCaps() {
  const config = await ensureSingleOfWeekConfig();
  return {
    dailyCap: config.requesterDailyCap,
    weeklyCap: config.requesterWeeklyCap,
    monthlyCap: config.requesterMonthlyCap,
  };
}

export async function getSingleOfWeekTargetUsage(featureId: string, featuredUserId: string, now = new Date()) {
  const { startOfDay, weekOf, startOfMonth } = getSingleOfWeekCountsWindow(now);
  const activeFeatureIds = await prisma.singleOfWeekFeature.findMany({
    where: {
      featuredUserId,
      status: SingleOfWeekFeatureStatus.ACTIVE,
    },
    select: { id: true },
  });

  const featureIds = Array.from(new Set([featureId, ...activeFeatureIds.map((feature) => feature.id)]));

  const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
    prisma.chatRequest.count({ where: { toUserId: featuredUserId, singleOfWeekFeatureId: { in: featureIds }, createdAt: { gte: startOfDay } } }),
    prisma.chatRequest.count({ where: { toUserId: featuredUserId, singleOfWeekFeatureId: { in: featureIds }, createdAt: { gte: weekOf } } }),
    prisma.chatRequest.count({ where: { toUserId: featuredUserId, singleOfWeekFeatureId: { in: featureIds }, createdAt: { gte: startOfMonth } } }),
  ]);

  return { dailyCount, weeklyCount, monthlyCount };
}

export async function getSingleOfWeekRequesterUsage(requesterUserId: string, now = new Date()) {
  const { startOfDay, weekOf, startOfMonth } = getSingleOfWeekCountsWindow(now);
  const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
    prisma.chatRequest.count({ where: { fromUserId: requesterUserId, singleOfWeekFeatureId: { not: null }, createdAt: { gte: startOfDay } } }),
    prisma.chatRequest.count({ where: { fromUserId: requesterUserId, singleOfWeekFeatureId: { not: null }, createdAt: { gte: weekOf } } }),
    prisma.chatRequest.count({ where: { fromUserId: requesterUserId, singleOfWeekFeatureId: { not: null }, createdAt: { gte: startOfMonth } } }),
  ]);

  return { dailyCount, weeklyCount, monthlyCount };
}

export async function canCreateSingleOfWeekRequest(featureId: string, requesterUserId: string, now = new Date()) {
  const feature = await prisma.singleOfWeekFeature.findUnique({
    where: { id: featureId },
    select: { id: true, featuredUserId: true },
  });

  if (!feature) {
    return {
      targetCaps: null,
      targetUsage: null,
      requesterCaps: null,
      requesterUsage: null,
      blocked: true,
      blockedBy: "target" as const,
      reason: "That featured member is not available right now.",
    };
  }

  const [targetCaps, targetUsage, requesterCaps, requesterUsage] = await Promise.all([
    getSingleOfWeekEffectiveTargetCaps(feature.id),
    getSingleOfWeekTargetUsage(feature.id, feature.featuredUserId, now),
    getSingleOfWeekRequesterCaps(),
    getSingleOfWeekRequesterUsage(requesterUserId, now),
  ]);

  const targetBlocked = targetUsage.dailyCount >= targetCaps.dailyCap || targetUsage.weeklyCount >= targetCaps.weeklyCap || targetUsage.monthlyCount >= targetCaps.monthlyCap;
  const requesterBlocked = requesterUsage.dailyCount >= requesterCaps.dailyCap || requesterUsage.weeklyCount >= requesterCaps.weeklyCap || requesterUsage.monthlyCount >= requesterCaps.monthlyCap;

  return {
    targetCaps,
    targetUsage,
    requesterCaps,
    requesterUsage,
    blocked: targetBlocked || requesterBlocked,
    blockedBy: targetBlocked ? ("target" as const) : requesterBlocked ? ("requester" as const) : null,
    reason: targetBlocked
      ? "This featured member has reached the maximum number of requests."
      : requesterBlocked
        ? "You have reached the maximum number of featured requests."
        : null,
  };
}

export async function buildSingleOfWeekShortlist(limit = 5) {
  const applicationApplicants = await prisma.singleOfWeekApplication.findMany({
    where: { status: { in: [SingleOfWeekApplicationStatus.SUBMITTED, SingleOfWeekApplicationStatus.SHORTLISTED] } },
    select: { applicantUserId: true },
  });
  await refreshUserTrustStates(prisma, applicationApplicants.map((entry) => entry.applicantUserId));

  const applications = await prisma.singleOfWeekApplication.findMany({
    where: { status: { in: [SingleOfWeekApplicationStatus.SUBMITTED, SingleOfWeekApplicationStatus.SHORTLISTED] } },
    include: {
      applicant: {
        select: {
          id: true,
          displayName: true,
          email: true,
          region: true,
          trustTier: true,
          trustScore: true,
          trustSummary: true,
          _count: {
            select: {
              posts: true,
              messages: true,
            },
          },
        },
      },
      photos: true,
    },
    orderBy: { submittedAt: "asc" },
  });

  const recentFeatures = await prisma.singleOfWeekFeature.findMany({
    where: { status: { in: [SingleOfWeekFeatureStatus.ACTIVE, SingleOfWeekFeatureStatus.COMPLETED] } },
    orderBy: { publishAt: "desc" },
    take: 4,
    select: { featuredUserId: true, application: { select: { applicant: { select: { region: true } } } } },
  });

  const recentFeaturedUserIds = new Set(recentFeatures.map((entry) => entry.featuredUserId));
  const recentRegions = new Set(recentFeatures.map((entry) => entry.application.applicant.region).filter(Boolean));

  return applications
    .map((application) => {
      let score = application.applicant._count.posts * 2 + application.applicant._count.messages;
      if (application.photos.length >= 3) score += 5;
      if (!recentFeaturedUserIds.has(application.applicant.id)) score += 4;
      if (application.applicant.region && !recentRegions.has(application.applicant.region)) score += 3;
      if (application.applicant.trustScore >= 85) score += 4;
      else if (application.applicant.trustScore >= SINGLE_OF_WEEK_MIN_TRUST_SCORE) score += 2;
      else if (application.applicant.trustTier === InternalTrustTier.HIGH) score += 1;
      return { application, score };
    })
    .sort((left, right) => right.score - left.score || left.application.submittedAt.getTime() - right.application.submittedAt.getTime())
    .slice(0, limit);
}

export async function recordSingleOfWeekView(featureId: string, viewerUserId: string) {
  return prisma.singleOfWeekView.upsert({
    where: { featureId_viewerUserId: { featureId, viewerUserId } },
    update: { viewedAt: new Date() },
    create: { featureId, viewerUserId },
  });
}

export async function getSingleOfWeekFeatureMetrics(featureId: string) {
  const [views, requests, approvals] = await Promise.all([
    prisma.singleOfWeekView.count({ where: { featureId } }),
    prisma.chatRequest.count({ where: { singleOfWeekFeatureId: featureId, originType: ChatRequestOriginType.SINGLE_OF_WEEK } }),
    prisma.chatRequest.count({ where: { singleOfWeekFeatureId: featureId, originType: ChatRequestOriginType.SINGLE_OF_WEEK, status: ChatRequestStatus.ACCEPTED } }),
  ]);

  return { views, requests, approvals };
}


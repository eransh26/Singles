import {
  AccountStatus,
  MediaModerationStatus,
  SingleOfWeekApplicationStatus,
  SingleOfWeekFeatureStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const MEDIA_AUTO_HIDE_WEIGHTED_THRESHOLD = 2.5;
export const REPORT_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 60 * 24;
export const REPORT_RATE_LIMIT_MAX_PER_WINDOW = 10;
export const REPORTER_ACTIVE_REPORT_SUPPRESSION_THRESHOLD = 3;

export type MediaQueuePriority = "urgent_featured" | "active_profile" | "profile" | "routine";
export type MediaStaleState = "fresh" | "over_24h" | "over_72h";
export type ReporterTrustTier = "LOW" | "NORMAL" | "HIGH";

export type ReporterSignalInput = {
  reportId: string;
  reporterUserId: string;
  reporter: {
    accountStatus?: AccountStatus | null;
    emailVerified?: Date | null;
    phoneVerifiedAt?: Date | null;
    approvedConversationCount?: number;
    activeReportsAgainstReporter?: number;
    activeBlockCount?: number;
    recentFiledReportCount?: number;
  } | null;
};

export type WeightedReportSignalSummary = {
  rawReportCount: number;
  distinctReporterCount: number;
  contributingReporterCount: number;
  suppressedReporterCount: number;
  weightedScore: number;
  threshold: number;
  triggered: boolean;
  trustBreakdown: Record<ReporterTrustTier, number>;
  dedupedReportIds: string[];
};

type ReportQueryClient = Prisma.TransactionClient | typeof prisma;

const ACTIVE_PROFILE_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;
const STALE_24H_MS = 1000 * 60 * 60 * 24;
const STALE_72H_MS = STALE_24H_MS * 3;

const PRIORITY_RANK: Record<MediaQueuePriority, number> = {
  urgent_featured: 0,
  active_profile: 1,
  profile: 2,
  routine: 3,
};

const REPORTER_TRUST_WEIGHTS: Record<ReporterTrustTier, number> = {
  LOW: 0.5,
  NORMAL: 1,
  HIGH: 2,
};

export function isMediaPubliclyVisible(input: {
  moderationStatus: MediaModerationStatus;
  hiddenByModeration?: boolean | null;
}) {
  return input.moderationStatus === MediaModerationStatus.APPROVED && !input.hiddenByModeration;
}

export function needsMediaModerationReview(input: {
  moderationStatus: MediaModerationStatus;
  hiddenByModeration?: boolean | null;
}) {
  return input.moderationStatus === MediaModerationStatus.PENDING_REVIEW || Boolean(input.hiddenByModeration);
}

export function getMediaReviewStartedAt(input: {
  uploadedAt: Date;
  hiddenAt?: Date | null;
}) {
  return input.hiddenAt ?? input.uploadedAt;
}

export function getMediaStaleState(reviewStartedAt: Date, now = new Date()): MediaStaleState {
  const ageMs = now.getTime() - reviewStartedAt.getTime();
  if (ageMs >= STALE_72H_MS) {
    return "over_72h";
  }
  if (ageMs >= STALE_24H_MS) {
    return "over_24h";
  }
  return "fresh";
}

export function getMediaStaleLabel(staleState: MediaStaleState) {
  if (staleState === "over_72h") {
    return ">72h";
  }
  if (staleState === "over_24h") {
    return ">24h";
  }
  return "Fresh";
}

export function formatPendingAge(reviewStartedAt: Date, now = new Date()) {
  const ageMs = Math.max(0, now.getTime() - reviewStartedAt.getTime());
  const totalHours = Math.floor(ageMs / (1000 * 60 * 60));
  if (totalHours < 1) {
    return "<1h";
  }
  if (totalHours < 24) {
    return `${totalHours}h`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function getMediaQueuePriority(
  input:
    | {
        type: "single-of-week";
        applicationStatus: SingleOfWeekApplicationStatus;
        featureStatuses: SingleOfWeekFeatureStatus[];
      }
    | {
        type: "profile";
        lastActiveAt?: Date | null;
        now?: Date;
      },
): MediaQueuePriority {
  if (input.type === "single-of-week") {
    const isFeaturedWork =
      input.applicationStatus === SingleOfWeekApplicationStatus.SHORTLISTED ||
      input.applicationStatus === SingleOfWeekApplicationStatus.SELECTED ||
      input.featureStatuses.some((status) => status === SingleOfWeekFeatureStatus.UPCOMING || status === SingleOfWeekFeatureStatus.ACTIVE);

    return isFeaturedWork ? "urgent_featured" : "routine";
  }

  const now = input.now ?? new Date();
  const isRecentlyActive = input.lastActiveAt ? now.getTime() - input.lastActiveAt.getTime() <= ACTIVE_PROFILE_WINDOW_MS : false;
  return isRecentlyActive ? "active_profile" : "profile";
}

export function getMediaQueuePriorityRank(priority: MediaQueuePriority) {
  return PRIORITY_RANK[priority];
}

export function getMediaQueuePriorityLabel(priority: MediaQueuePriority) {
  switch (priority) {
    case "urgent_featured":
      return "Urgent featured";
    case "active_profile":
      return "Active member profile";
    case "profile":
      return "Profile";
    default:
      return "Routine";
  }
}

export function isReporterSignalSuppressed(input: ReporterSignalInput["reporter"]) {
  if (!input || input.accountStatus !== AccountStatus.ACTIVE) {
    return true;
  }

  if ((input.activeReportsAgainstReporter ?? 0) >= REPORTER_ACTIVE_REPORT_SUPPRESSION_THRESHOLD) {
    return true;
  }

  if ((input.recentFiledReportCount ?? 0) >= REPORT_RATE_LIMIT_MAX_PER_WINDOW) {
    return true;
  }

  return false;
}

export function getReporterTrustTier(input: ReporterSignalInput["reporter"]): ReporterTrustTier {
  if (!input || input.accountStatus !== AccountStatus.ACTIVE) {
    return "LOW";
  }

  const isVerified = Boolean(input.emailVerified && input.phoneVerifiedAt);
  const hasTrustedHistory = (input.approvedConversationCount ?? 0) > 0;
  const hasLowSignalQuality = (input.activeReportsAgainstReporter ?? 0) > 0 || (input.activeBlockCount ?? 0) >= 4;

  if (isVerified && hasTrustedHistory && !hasLowSignalQuality) {
    return "HIGH";
  }

  if (isVerified || hasTrustedHistory) {
    return "NORMAL";
  }

  return "LOW";
}

export function getReporterTrustWeight(tier: ReporterTrustTier) {
  return REPORTER_TRUST_WEIGHTS[tier];
}

export function summarizeWeightedReportSignal(inputs: ReporterSignalInput[]): WeightedReportSignalSummary {
  const dedupedByReporter = new Map<string, ReporterSignalInput>();
  const rawReportCount = inputs.length;

  for (const input of inputs) {
    if (!dedupedByReporter.has(input.reporterUserId)) {
      dedupedByReporter.set(input.reporterUserId, input);
    }
  }

  const trustBreakdown: Record<ReporterTrustTier, number> = {
    LOW: 0,
    NORMAL: 0,
    HIGH: 0,
  };

  let weightedScore = 0;
  let suppressedReporterCount = 0;
  let contributingReporterCount = 0;

  for (const entry of dedupedByReporter.values()) {
    if (isReporterSignalSuppressed(entry.reporter)) {
      suppressedReporterCount += 1;
      continue;
    }

    const tier = getReporterTrustTier(entry.reporter);
    trustBreakdown[tier] += 1;
    contributingReporterCount += 1;
    weightedScore += getReporterTrustWeight(tier);
  }

  return {
    rawReportCount,
    distinctReporterCount: dedupedByReporter.size,
    contributingReporterCount,
    suppressedReporterCount,
    weightedScore,
    threshold: MEDIA_AUTO_HIDE_WEIGHTED_THRESHOLD,
    triggered: weightedScore >= MEDIA_AUTO_HIDE_WEIGHTED_THRESHOLD,
    trustBreakdown,
    dedupedReportIds: Array.from(dedupedByReporter.values()).map((entry) => entry.reportId),
  };
}

export async function getWeightedUserReportSignalSummary(db: ReportQueryClient, targetUserId: string): Promise<WeightedReportSignalSummary> {
  const reports = await db.report.findMany({
    where: {
      targetType: "USER",
      targetUserId,
      status: { in: ["OPEN", "IN_REVIEW"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      filedByUserId: true,
      filedBy: {
        select: {
          id: true,
          accountStatus: true,
          emailVerified: true,
          phoneVerifiedAt: true,
        },
      },
    },
  });

  const reporterIds = Array.from(new Set(reports.map((report) => report.filedByUserId)));
  const reporterSignals = new Map<string, ReporterSignalInput["reporter"]>();

  await Promise.all(
    reporterIds.map(async (reporterUserId) => {
      const [approvedConversationCount, activeReportsAgainstReporter, activeBlockCount, recentFiledReportCount] = await Promise.all([
        db.conversation.count({
          where: {
            kind: "MEMBER_CHAT",
            status: "ACTIVE",
            OR: [{ userOneId: reporterUserId }, { userTwoId: reporterUserId }],
          },
        }),
        db.report.count({
          where: {
            targetType: "USER",
            targetUserId: reporterUserId,
            status: { in: ["OPEN", "IN_REVIEW"] },
          },
        }),
        db.userBlock.count({
          where: {
            OR: [{ blockerUserId: reporterUserId }, { blockedUserId: reporterUserId }],
          },
        }),
        db.report.count({
          where: {
            filedByUserId: reporterUserId,
            createdAt: { gte: new Date(Date.now() - REPORT_RATE_LIMIT_WINDOW_MS) },
          },
        }),
      ]);

      const reporter = reports.find((report) => report.filedByUserId === reporterUserId)?.filedBy ?? null;
      reporterSignals.set(
        reporterUserId,
        reporter
          ? {
              accountStatus: reporter.accountStatus,
              emailVerified: reporter.emailVerified,
              phoneVerifiedAt: reporter.phoneVerifiedAt,
              approvedConversationCount,
              activeReportsAgainstReporter,
              activeBlockCount,
              recentFiledReportCount,
            }
          : null,
      );
    }),
  );

  return summarizeWeightedReportSignal(
    reports.map((report) => ({
      reportId: report.id,
      reporterUserId: report.filedByUserId,
      reporter: reporterSignals.get(report.filedByUserId) ?? null,
    })),
  );
}

export function formatWeightedSignalSummary(summary: WeightedReportSignalSummary) {
  return `Weighted signal ${summary.weightedScore.toFixed(1)} / ${summary.threshold.toFixed(1)} from ${summary.distinctReporterCount} distinct reporters (${summary.rawReportCount} reports).`;
}

export function formatWeightedSignalBreakdown(summary: WeightedReportSignalSummary) {
  const parts: string[] = [];
  if (summary.trustBreakdown.HIGH > 0) {
    parts.push(`${summary.trustBreakdown.HIGH} high`);
  }
  if (summary.trustBreakdown.NORMAL > 0) {
    parts.push(`${summary.trustBreakdown.NORMAL} normal`);
  }
  if (summary.trustBreakdown.LOW > 0) {
    parts.push(`${summary.trustBreakdown.LOW} low`);
  }
  if (summary.suppressedReporterCount > 0) {
    parts.push(`${summary.suppressedReporterCount} suppressed`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No contributing reporters";
}

export async function autoHideReportedUserMedia(tx: Prisma.TransactionClient, targetUserId: string) {
  const signalSummary = await getWeightedUserReportSignalSummary(tx, targetUserId);

  if (!signalSummary.triggered) {
    return {
      triggered: false,
      signalSummary,
      hiddenProfileCount: 0,
      hiddenSingleOfWeekCount: 0,
    };
  }

  const hiddenAt = new Date();
  const hiddenReason = `${formatWeightedSignalSummary(signalSummary)} Auto-hidden pending admin review.`;

  const [profileResult, singleOfWeekResult] = await Promise.all([
    tx.userProfileImageAsset.updateMany({
      where: {
        userId: targetUserId,
        moderationStatus: MediaModerationStatus.APPROVED,
        hiddenByModeration: false,
      },
      data: {
        hiddenByModeration: true,
        hiddenAt,
        hiddenReason,
      },
    }),
    tx.singleOfWeekApplicationPhoto.updateMany({
      where: {
        application: { applicantUserId: targetUserId },
        moderationStatus: MediaModerationStatus.APPROVED,
        hiddenByModeration: false,
      },
      data: {
        hiddenByModeration: true,
        hiddenAt,
        hiddenReason,
      },
    }),
  ]);

  if (profileResult.count > 0 || singleOfWeekResult.count > 0) {
    await tx.auditLog.create({
      data: {
        action: "system.media.auto_hidden",
        targetType: "User",
        targetId: targetUserId,
        metadataJson: {
          hiddenProfileCount: profileResult.count,
          hiddenSingleOfWeekCount: singleOfWeekResult.count,
          hiddenReason,
          signalSummary,
        },
      },
    });
  }

  return {
    triggered: profileResult.count > 0 || singleOfWeekResult.count > 0,
    signalSummary,
    hiddenProfileCount: profileResult.count,
    hiddenSingleOfWeekCount: singleOfWeekResult.count,
  };
}

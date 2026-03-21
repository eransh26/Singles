import {
  BuddyApplicationDomainStatus,
  InternalTrustTier,
  MediaModerationStatus,
  ReportStatus,
  ReportTargetType,
  SingleOfWeekApplicationStatus,
  SingleOfWeekFeatureStatus,
  VerificationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  formatPendingAge,
  getMediaQueuePriority,
  getMediaQueuePriorityLabel,
  getMediaQueuePriorityRank,
  getMediaReviewStartedAt,
  getMediaStaleLabel,
  getMediaStaleState,
  needsMediaModerationReview,
  type MediaQueuePriority,
} from "@/lib/media-moderation";
import { formatTrustLabel, refreshUserTrustStates } from "@/lib/internal-trust";
import {
  ensureSingleOfWeekConfig,
  getSingleOfWeekEffectiveTargetCaps,
  getSingleOfWeekTargetUsage,
  syncSingleOfWeekState,
} from "@/lib/single-of-the-week";

const LOW_TRUST_TIERS: InternalTrustTier[] = [InternalTrustTier.LOW];

export type ActionCenterAttentionItem = {
  id: string;
  type: string;
  title: string;
  summary: string;
  context: string | null;
  ageLabel: string;
  href: string;
  ctaLabel: string;
  priorityRank: number;
};

export type ActionCenterModerationItem = {
  key: string;
  itemType: "profile" | "single-of-week";
  id: string;
  displayName: string;
  email: string;
  previewUrl: string;
  moderationStatus: MediaModerationStatus;
  hiddenByModeration: boolean;
  moderationNote: string | null;
  trustLabel: string;
  priority: MediaQueuePriority;
  priorityLabel: string;
  staleLabel: string | null;
  ageLabel: string;
  reviewStartedAt: Date;
  href: string;
  canInlineReview: boolean;
};

export type ActionCenterBuddyItem = {
  id: string;
  applicationDomainId: string;
  applicantName: string;
  applicantEmail: string;
  trustLabel: string;
  domainName: string;
  status: BuddyApplicationDomainStatus;
  createdAt: Date;
  canInlineReview: boolean;
};

const ATTENTION_PRIORITY = {
  FEATURED_PENDING: 0,
  AUTO_HIDDEN_MEDIA: 1,
  STALE_MODERATION: 2,
  LOW_TRUST_BUDDY: 3,
  REPORTS: 4,
  VERIFICATION: 5,
} as const;

export type ActionCenterRiskSignal = {
  id: string;
  title: string;
  summary: string;
  context: string | null;
  href: string;
};

export type ActionCenterFeaturedData = {
  activeFeature: null | {
    id: string;
    displayName: string;
    trustLabel: string;
    status: SingleOfWeekFeatureStatus;
    usageSummary: string;
  };
  upcomingCandidates: Array<{
    id: string;
    displayName: string;
    trustLabel: string;
    status: SingleOfWeekApplicationStatus;
    photoPendingCount: number;
  }>;
};

export async function getAdminActionCenterData() {
  await ensureSingleOfWeekConfig();
  const featuredState = await syncSingleOfWeekState();
  const now = new Date();

  const [
    profileAssets,
    singleOfWeekPhotos,
    oldestOpenReport,
    pendingVerification,
    buddyQueue,
    lowTrustUsers,
    activeFeatureReports,
    featuredApplications,
  ] = await Promise.all([
    prisma.userProfileImageAsset.findMany({
      where: {
        OR: [{ moderationStatus: MediaModerationStatus.PENDING_REVIEW }, { hiddenByModeration: true }],
      },
      orderBy: { uploadedAt: "asc" },
      take: 10,
      select: {
        id: true,
        uploadedAt: true,
        hiddenAt: true,
        moderationStatus: true,
        moderationNote: true,
        hiddenByModeration: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            activityState: { select: { lastActiveAt: true } },
          },
        },
      },
    }),
    prisma.singleOfWeekApplicationPhoto.findMany({
      where: {
        OR: [{ moderationStatus: MediaModerationStatus.PENDING_REVIEW }, { hiddenByModeration: true }],
      },
      orderBy: { uploadedAt: "asc" },
      take: 10,
      select: {
        id: true,
        uploadedAt: true,
        hiddenAt: true,
        moderationStatus: true,
        moderationNote: true,
        hiddenByModeration: true,
        application: {
          select: {
            id: true,
            status: true,
            applicant: {
              select: { id: true, displayName: true, email: true },
            },
            features: {
              orderBy: { publishAt: "desc" },
              take: 3,
              select: { status: true },
            },
          },
        },
      },
    }),
    prisma.report.findFirst({
      where: { status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        reasonCode: true,
        targetType: true,
      },
    }),
    prisma.verificationRequest.findFirst({
      where: { status: VerificationStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        user: { select: { displayName: true, email: true } },
      },
    }),
    prisma.buddyApplicationDomain.findMany({
      where: {
        status: {
          in: [
            BuddyApplicationDomainStatus.PENDING_RECOMMENDATIONS,
            BuddyApplicationDomainStatus.REPLACEMENT_NEEDED,
            BuddyApplicationDomainStatus.PENDING_ADMIN_REVIEW,
          ],
        },
      },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        status: true,
        domain: { select: { name: true } },
        application: {
          select: {
            applicant: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { trustTier: { in: LOW_TRUST_TIERS }, trustUpdatedAt: { not: null } },
      orderBy: { trustUpdatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        displayName: true,
        trustTier: true,
        trustSummary: true,
        trustUpdatedAt: true,
      },
    }),
    featuredState?.status === "ACTIVE"
      ? prisma.report.count({
          where: {
            targetType: ReportTargetType.USER,
            targetUserId: featuredState.featuredUserId,
            status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] },
          },
        })
      : Promise.resolve(0),
    prisma.singleOfWeekApplication.findMany({
      where: { status: { in: [SingleOfWeekApplicationStatus.SHORTLISTED, SingleOfWeekApplicationStatus.SELECTED, SingleOfWeekApplicationStatus.SUBMITTED] } },
      orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
      take: 4,
      select: {
        id: true,
        status: true,
        applicant: { select: { id: true, displayName: true } },
        photos: {
          select: { moderationStatus: true, hiddenByModeration: true },
        },
      },
    }),
  ]);

  const trustUserIds = Array.from(
    new Set([
      ...profileAssets.map((asset) => asset.user.id),
      ...singleOfWeekPhotos.map((photo) => photo.application.applicant.id),
      ...buddyQueue.map((entry) => entry.application.applicant.id),
      ...featuredApplications.map((entry) => entry.applicant.id),
      ...(featuredState?.status === "ACTIVE" ? [featuredState.featuredUserId] : []),
    ]),
  );
  await refreshUserTrustStates(prisma, trustUserIds);
  const trustRows = await prisma.user.findMany({
    where: { id: { in: trustUserIds } },
    select: { id: true, trustTier: true, trustSummary: true },
  });
  const trustByUserId = new Map(trustRows.map((row) => [row.id, formatTrustLabel(row.trustTier, row.trustSummary)]));

  const moderationItems: ActionCenterModerationItem[] = [
    ...profileAssets.map((asset) => {
      const reviewStartedAt = getMediaReviewStartedAt({ uploadedAt: asset.uploadedAt, hiddenAt: asset.hiddenAt });
      const priority = getMediaQueuePriority({
        type: "profile",
        lastActiveAt: asset.user.activityState?.lastActiveAt,
        now,
      });
      return {
        key: `profile:${asset.id}`,
        itemType: "profile" as const,
        id: asset.id,
        displayName: asset.user.displayName,
        email: asset.user.email,
        previewUrl: `/api/media/profile-image/${asset.id}`,
        moderationStatus: asset.moderationStatus,
        hiddenByModeration: asset.hiddenByModeration,
        moderationNote: asset.moderationNote,
        trustLabel: trustByUserId.get(asset.user.id) ?? "LOW",
        priority,
        priorityLabel: getMediaQueuePriorityLabel(priority),
        staleLabel: getMediaStaleLabel(getMediaStaleState(reviewStartedAt, now)),
        ageLabel: formatPendingAge(reviewStartedAt, now),
        reviewStartedAt,
        href: "/admin/media",
        canInlineReview: true,
      };
    }),
    ...singleOfWeekPhotos.map((photo) => {
      const reviewStartedAt = getMediaReviewStartedAt({ uploadedAt: photo.uploadedAt, hiddenAt: photo.hiddenAt });
      const priority = getMediaQueuePriority({
        type: "single-of-week",
        applicationStatus: photo.application.status,
        featureStatuses: photo.application.features.map((feature) => feature.status),
      });
      return {
        key: `single-of-week:${photo.id}`,
        itemType: "single-of-week" as const,
        id: photo.id,
        displayName: photo.application.applicant.displayName,
        email: photo.application.applicant.email,
        previewUrl: `/api/media/single-of-week-photo/${photo.id}`,
        moderationStatus: photo.moderationStatus,
        hiddenByModeration: photo.hiddenByModeration,
        moderationNote: null,
        trustLabel: trustByUserId.get(photo.application.applicant.id) ?? "LOW",
        priority,
        priorityLabel: getMediaQueuePriorityLabel(priority),
        staleLabel: getMediaStaleLabel(getMediaStaleState(reviewStartedAt, now)),
        ageLabel: formatPendingAge(reviewStartedAt, now),
        reviewStartedAt,
        href: "/admin/media",
        canInlineReview: true,
      };
    }),
  ]
    .filter((item) => needsMediaModerationReview(item))
    .sort((left, right) => {
      const rankDiff = getMediaQueuePriorityRank(left.priority) - getMediaQueuePriorityRank(right.priority);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return left.reviewStartedAt.getTime() - right.reviewStartedAt.getTime();
    })
    .slice(0, 4);

  const buddyPreview: ActionCenterBuddyItem[] = buddyQueue
    .map((entry) => ({
      id: entry.id,
      applicationDomainId: entry.id,
      applicantName: entry.application.applicant.displayName,
      applicantEmail: entry.application.applicant.email,
      trustLabel: trustByUserId.get(entry.application.applicant.id) ?? "LOW",
      domainName: entry.domain.name,
      status: entry.status,
      createdAt: entry.createdAt,
      canInlineReview: entry.status === BuddyApplicationDomainStatus.PENDING_ADMIN_REVIEW,
    }))
    .sort((left, right) => {
      if (left.canInlineReview !== right.canInlineReview) {
        return left.canInlineReview ? -1 : 1;
      }
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  const topFeaturedModerationItem = moderationItems.find(
    (item) => item.itemType === "single-of-week" && !item.hiddenByModeration,
  );
  const topHiddenModerationItem = moderationItems.find((item) => item.hiddenByModeration);
  const topStaleModerationItem = moderationItems.find(
    (item) => Boolean(item.staleLabel) && !item.hiddenByModeration && item !== topFeaturedModerationItem,
  );
  const lowTrustBuddyItem = buddyPreview.find((item) => item.trustLabel.startsWith("LOW"));

  const attentionItems: ActionCenterAttentionItem[] = [
    ...(topFeaturedModerationItem
      ? [{
          id: topFeaturedModerationItem.key,
          type: "Featured",
          title: "Featured photo needs review",
          summary: `${topFeaturedModerationItem.displayName} · featured photo`,
          context: `Trust ${topFeaturedModerationItem.trustLabel} · ${topFeaturedModerationItem.priorityLabel}`,
          ageLabel: topFeaturedModerationItem.ageLabel,
          href: "/admin/media",
          ctaLabel: "Review featured media",
          priorityRank: ATTENTION_PRIORITY.FEATURED_PENDING,
        }]
      : []),
    ...(topHiddenModerationItem
      ? [{
          id: topHiddenModerationItem.key,
          type: "Media",
          title: "Auto-hidden media awaiting review",
          summary: `${topHiddenModerationItem.displayName} · ${topHiddenModerationItem.itemType === "profile" ? "profile image" : "featured photo"}`,
          context: `Trust ${topHiddenModerationItem.trustLabel} · ${topHiddenModerationItem.priorityLabel}`,
          ageLabel: topHiddenModerationItem.ageLabel,
          href: "/admin/media",
          ctaLabel: "Review media",
          priorityRank: ATTENTION_PRIORITY.AUTO_HIDDEN_MEDIA,
        }]
      : []),
    ...(topStaleModerationItem
      ? [{
          id: topStaleModerationItem.key,
          type: "Moderation",
          title: "Stale high-priority moderation item",
          summary: `${topStaleModerationItem.displayName} · ${topStaleModerationItem.itemType === "profile" ? "profile image" : "featured photo"}`,
          context: `Trust ${topStaleModerationItem.trustLabel} · ${topStaleModerationItem.staleLabel ?? topStaleModerationItem.priorityLabel}`,
          ageLabel: topStaleModerationItem.ageLabel,
          href: "/admin/media",
          ctaLabel: "Review moderation",
          priorityRank: ATTENTION_PRIORITY.STALE_MODERATION,
        }]
      : []),
    ...(oldestOpenReport
      ? [{
          id: `report:${oldestOpenReport.id}`,
          type: "Report",
          title: "Oldest open report",
          summary: `${oldestOpenReport.targetType} · ${oldestOpenReport.reasonCode}`,
          context: null,
          ageLabel: formatPendingAge(oldestOpenReport.createdAt, now),
          href: "/admin/reports",
          ctaLabel: "Review report",
          priorityRank: ATTENTION_PRIORITY.REPORTS,
        }]
      : []),
    ...(lowTrustBuddyItem
      ? [{
          id: `buddy:${lowTrustBuddyItem.id}`,
          type: "Buddy",
          title: "Low-trust Buddy applicant pending decision",
          summary: `${lowTrustBuddyItem.applicantName} · ${lowTrustBuddyItem.domainName}`,
          context: `Trust ${lowTrustBuddyItem.trustLabel}`,
          ageLabel: formatPendingAge(lowTrustBuddyItem.createdAt, now),
          href: "/admin/buddy",
          ctaLabel: "Review Buddy",
          priorityRank: ATTENTION_PRIORITY.LOW_TRUST_BUDDY,
        }]
      : []),
    ...(pendingVerification
      ? [{
          id: `verification:${pendingVerification.id}`,
          type: "Verification",
          title: "Verification request waiting",
          summary: pendingVerification.user.displayName,
          context: pendingVerification.user.email,
          ageLabel: formatPendingAge(pendingVerification.createdAt, now),
          href: "/admin/verifications",
          ctaLabel: "Review verification",
          priorityRank: ATTENTION_PRIORITY.VERIFICATION,
        }]
      : []),
  ];

  let activeFeatureData: ActionCenterFeaturedData["activeFeature"] = null;
  if (featuredState?.status === "ACTIVE") {
    const [effectiveCaps, usage] = await Promise.all([
      getSingleOfWeekEffectiveTargetCaps(featuredState.id),
      getSingleOfWeekTargetUsage(featuredState.id, featuredState.featuredUserId),
    ]);
    activeFeatureData = {
      id: featuredState.id,
      displayName: featuredState.application.applicant.displayName,
      trustLabel: trustByUserId.get(featuredState.featuredUserId) ?? "LOW",
      status: featuredState.status,
      usageSummary: `${usage.dailyCount}/${effectiveCaps.dailyCap} daily · ${usage.weeklyCount}/${effectiveCaps.weeklyCap} weekly · ${usage.monthlyCount}/${effectiveCaps.monthlyCap} monthly`,
    };

    const usageRatios = [
      effectiveCaps.dailyCap > 0 ? usage.dailyCount / effectiveCaps.dailyCap : 0,
      effectiveCaps.weeklyCap > 0 ? usage.weeklyCount / effectiveCaps.weeklyCap : 0,
      effectiveCaps.monthlyCap > 0 ? usage.monthlyCount / effectiveCaps.monthlyCap : 0,
    ];
    const highestRatio = Math.max(...usageRatios);
    if (highestRatio >= 0.8) {
      attentionItems.push({
        id: `featured-cap:${featuredState.id}`,
        type: "Featured",
        title: "Featured request caps nearing limit",
        summary: featuredState.application.applicant.displayName,
        context: activeFeatureData.usageSummary,
        ageLabel: "Live",
        href: "/admin/single-of-the-week",
        ctaLabel: "Open featured queue",
        priorityRank: 5,
      });
    }
  }

  const riskSignals: ActionCenterRiskSignal[] = [
    ...lowTrustUsers.map((user) => ({
      id: `low-trust:${user.id}`,
      title: "User dropped to LOW trust",
      summary: user.displayName,
      context: user.trustSummary ?? null,
      href: "/admin/users",
    })),
    ...moderationItems
      .filter((item) => item.hiddenByModeration)
      .slice(0, 2)
      .map((item) => ({
        id: `hidden-media:${item.key}`,
        title: "New auto-hidden media",
        summary: `${item.displayName} · ${item.itemType === "profile" ? "profile image" : "featured photo"}`,
        context: `Trust ${item.trustLabel}`,
        href: "/admin/media",
      })),
    ...(featuredState?.status === "ACTIVE" && activeFeatureReports > 0
      ? [{
          id: `featured-reports:${featuredState.id}`,
          title: "Featured user has active reports",
          summary: featuredState.application.applicant.displayName,
          context: `${activeFeatureReports} report${activeFeatureReports === 1 ? "" : "s"} open`,
          href: "/admin/single-of-the-week",
        }]
      : []),
  ].slice(0, 6);

  const featuredData: ActionCenterFeaturedData = {
    activeFeature: activeFeatureData,
    upcomingCandidates: featuredApplications.slice(0, 3).map((application) => ({
      id: application.id,
      displayName: application.applicant.displayName,
      trustLabel: trustByUserId.get(application.applicant.id) ?? "LOW",
      status: application.status,
      photoPendingCount: application.photos.filter((photo) => photo.moderationStatus === MediaModerationStatus.PENDING_REVIEW || photo.hiddenByModeration).length,
    })),
  };

  return {
    needsAttention: attentionItems.sort((left, right) => left.priorityRank - right.priorityRank).slice(0, 6),
    riskSignals,
    moderationPreview: moderationItems,
    buddyPreview: buddyPreview.slice(0, 4),
    featuredData,
    quickActions: [
      { label: "Review next media item", href: "/admin/media", hint: "Open the prioritized moderation queue." },
      { label: "Review next report", href: "/admin/reports", hint: "Jump into open reports and moderation actions." },
      { label: "Review next Buddy application", href: "/admin/buddy", hint: "Open pending Buddy recommendation and admin review work." },
      { label: "Review featured candidate", href: "/admin/single-of-the-week", hint: "Open current featured and shortlist operations." },
      { label: "Review verifications", href: "/admin/verifications", hint: "Handle pending verification requests." },
      { label: "Open dashboard", href: "/admin/dashboard", hint: "Switch to the high-level overview." },
    ],
  };
}

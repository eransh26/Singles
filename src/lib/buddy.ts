import {
  AccountStatus,
  BuddyApplicationDomainStatus,
  BuddyApplicationStatus,
  BuddyRequestAssignmentStatus,
  BuddyRequestStatus,
  BuddySupportMode,
  BuddyRecommendationStatus,
  ConsentStatus,
  ConversationKind,
  ConversationStatus,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createNotificationRecord, deliverNotifications } from "@/lib/notifications";

export const BUDDY_REQUEST_WINDOW_HOURS = 48;
export const BUDDY_AUTO_CANCEL_DAYS = 5;
export const BUDDY_REQUEST_COOLDOWN_HOURS = 24;
export const BUDDY_MAX_TEXT_LENGTH = 3000;
export const BUDDY_RECOMMENDATION_MAX_NOTE_LENGTH = 500;
export const MAX_BUDDY_DOMAIN_REJECTIONS = 3;

export const DEFAULT_BUDDY_DOMAINS = [
  { slug: "divorce-support", name: "Divorce support" },
  { slug: "emotional-support", name: "Emotional support" },
  { slug: "starting-over", name: "Starting over / rebuilding life" },
  { slug: "dating-after-divorce", name: "Dating after divorce" },
  { slug: "bdsm-guidance", name: "BDSM lifestyle guidance" },
  { slug: "relationship-support", name: "Relationship support" },
  { slug: "someone-to-talk-to", name: "Someone to talk to" },
] as const;

export const BUDDY_SUPPORT_MODE_OPTIONS: Array<{ value: BuddySupportMode; label: string }> = [
  { value: BuddySupportMode.CHAT_ONLY, label: "Chat only" },
  { value: BuddySupportMode.VIDEO_OK, label: "Video okay" },
  { value: BuddySupportMode.EITHER, label: "Either" },
];

export function isBuddyVerifiedUser(user: { emailVerified: Date | null; phoneVerifiedAt: Date | null }) {
  return Boolean(user.emailVerified && user.phoneVerifiedAt);
}

export function getBuddyRequestDeadline(base = new Date()) {
  return new Date(base.getTime() + BUDDY_REQUEST_WINDOW_HOURS * 60 * 60 * 1000);
}

export function getBuddyAutoCancelDeadline(base = new Date()) {
  return new Date(base.getTime() + BUDDY_AUTO_CANCEL_DAYS * 24 * 60 * 60 * 1000);
}

export function getBuddyRequestCooldownDeadline(base = new Date()) {
  return new Date(base.getTime() + BUDDY_REQUEST_COOLDOWN_HOURS * 60 * 60 * 1000);
}

export async function ensureBuddyDomainsSeeded(tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient = prisma) {
  await Promise.all(
    DEFAULT_BUDDY_DOMAINS.map((domain, index) =>
      tx.buddyDomainRecord.upsert({
        where: { slug: domain.slug },
        update: { name: domain.name, sortOrder: index },
        create: { slug: domain.slug, name: domain.name, isActive: true, sortOrder: index },
      }),
    ),
  );
}

export async function listBuddyDomains(includeInactive = false) {
  await ensureBuddyDomainsSeeded();
  return prisma.buddyDomainRecord.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, description: true, isActive: true },
  });
}

export async function getBuddyDomainOptions(includeInactive = false) {
  const domains = await listBuddyDomains(includeInactive);
  return domains.map((domain) => ({ value: domain.id, label: domain.name, slug: domain.slug, isActive: domain.isActive }));
}

export async function getEligibleBuddyRecommenders(
  tx: Prisma.TransactionClient,
  applicantUserId: string,
) {
  const conversations = await tx.conversation.findMany({
    where: {
      kind: ConversationKind.MEMBER_CHAT,
      status: ConversationStatus.ACTIVE,
      OR: [{ userOneId: applicantUserId }, { userTwoId: applicantUserId }],
    },
    select: { userOneId: true, userTwoId: true },
  });

  const connectedUserIds = Array.from(
    new Set(
      conversations.map((conversation) =>
        conversation.userOneId === applicantUserId ? conversation.userTwoId : conversation.userOneId,
      ),
    ),
  );

  if (connectedUserIds.length === 0) {
    return [] as Array<{ id: string; displayName: string }>;
  }

  const blockedPairs = await tx.userBlock.findMany({
    where: {
      OR: [
        { blockerUserId: applicantUserId, blockedUserId: { in: connectedUserIds } },
        { blockerUserId: { in: connectedUserIds }, blockedUserId: applicantUserId },
      ],
    },
    select: { blockerUserId: true, blockedUserId: true },
  });

  const blockedUserIds = new Set(
    blockedPairs.map((entry) => (entry.blockerUserId === applicantUserId ? entry.blockedUserId : entry.blockerUserId)),
  );

  return tx.user.findMany({
    where: {
      id: { in: connectedUserIds.filter((id) => !blockedUserIds.has(id)) },
      accountStatus: AccountStatus.ACTIVE,
      role: UserRole.USER,
      emailVerified: { not: null },
      phoneVerifiedAt: { not: null },
    },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
}

export async function countBuddyDomainRejectedAttempts(
  tx: Prisma.TransactionClient,
  applicantUserId: string,
  domainId: string,
) {
  return tx.buddyApplicationDomain.count({
    where: {
      domainId,
      status: BuddyApplicationDomainStatus.REJECTED,
      application: { applicantUserId },
    },
  });
}

export async function hasBuddyReapplicationOverride(
  tx: Prisma.TransactionClient,
  applicantUserId: string,
  domainId: string,
) {
  const override = await tx.buddyReapplicationOverride.findUnique({
    where: { userId_domainId: { userId: applicantUserId, domainId } },
    select: { isActive: true },
  });
  return Boolean(override?.isActive);
}

export async function syncBuddyApplicationDomainStatus(
  tx: Prisma.TransactionClient,
  applicationDomainId: string,
) {
  const applicationDomain = await tx.buddyApplicationDomain.findUnique({
    where: { id: applicationDomainId },
    select: {
      id: true,
      status: true,
      applicationId: true,
      recommendations: {
        where: { replacedAt: null },
        select: { id: true, status: true },
      },
    },
  });

  if (!applicationDomain) {
    return null;
  }

  if (
    applicationDomain.status === BuddyApplicationDomainStatus.APPROVED ||
    applicationDomain.status === BuddyApplicationDomainStatus.REJECTED ||
    applicationDomain.status === BuddyApplicationDomainStatus.CANCELLED
  ) {
    await syncBuddyApplicationStatus(tx, applicationDomain.applicationId);
    return applicationDomain.status;
  }

  const activeRecommendations = applicationDomain.recommendations;
  const approvedCount = activeRecommendations.filter((recommendation) => recommendation.status === BuddyRecommendationStatus.APPROVED).length;
  const hasDecline = activeRecommendations.some((recommendation) => recommendation.status === BuddyRecommendationStatus.DECLINED);

  const nextStatus = approvedCount >= 2
    ? BuddyApplicationDomainStatus.PENDING_ADMIN_REVIEW
    : hasDecline
      ? BuddyApplicationDomainStatus.REPLACEMENT_NEEDED
      : BuddyApplicationDomainStatus.PENDING_RECOMMENDATIONS;

  if (nextStatus !== applicationDomain.status) {
    await tx.buddyApplicationDomain.update({
      where: { id: applicationDomain.id },
      data: { status: nextStatus },
    });
  }

  await syncBuddyApplicationStatus(tx, applicationDomain.applicationId);
  return nextStatus;
}

export async function syncBuddyApplicationStatus(
  tx: Prisma.TransactionClient,
  applicationId: string,
) {
  const application = await tx.buddyApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      domains: { select: { status: true } },
    },
  });

  if (!application) {
    return null;
  }

  if (application.status === BuddyApplicationStatus.CANCELLED) {
    return application.status;
  }

  const domainStatuses = application.domains.map((domain) => domain.status);
  const allTerminal = domainStatuses.length > 0 && domainStatuses.every((status) =>
    status === BuddyApplicationDomainStatus.APPROVED ||
    status === BuddyApplicationDomainStatus.REJECTED ||
    status === BuddyApplicationDomainStatus.CANCELLED,
  );

  const nextStatus = allTerminal ? BuddyApplicationStatus.COMPLETED : BuddyApplicationStatus.ACTIVE;

  if (nextStatus !== application.status) {
    await tx.buddyApplication.update({
      where: { id: application.id },
      data: {
        status: nextStatus,
        completedAt: nextStatus === BuddyApplicationStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  return nextStatus;
}

export async function approveBuddyApplicationDomain(
  tx: Prisma.TransactionClient,
  applicationDomainId: string,
  adminUserId: string,
) {
  const applicationDomain = await tx.buddyApplicationDomain.findUnique({
    where: { id: applicationDomainId },
    select: {
      id: true,
      domainId: true,
      status: true,
      application: {
        select: {
          id: true,
          applicantUserId: true,
          intro: true,
          availabilityLevel: true,
        },
      },
    },
  });

  if (!applicationDomain) {
    throw new Error("Buddy application domain not found.");
  }

  if (applicationDomain.status !== BuddyApplicationDomainStatus.PENDING_ADMIN_REVIEW) {
    throw new Error("This Buddy domain is not ready for admin review.");
  }

  await tx.buddyProfile.upsert({
    where: { userId: applicationDomain.application.applicantUserId },
    update: {
      intro: applicationDomain.application.intro,
      availabilityLevel: applicationDomain.application.availabilityLevel,
    },
    create: {
      userId: applicationDomain.application.applicantUserId,
      intro: applicationDomain.application.intro,
      availabilityLevel: applicationDomain.application.availabilityLevel,
      isAvailable: false,
    },
  });

  await tx.buddyApplicationDomain.update({
    where: { id: applicationDomain.id },
    data: {
      status: BuddyApplicationDomainStatus.APPROVED,
      approvedAt: new Date(),
      adminReviewedAt: new Date(),
      approvedByAdminId: adminUserId,
      rejectedAt: null,
      rejectedByAdminId: null,
    },
  });

  await tx.buddyProfileDomain.upsert({
    where: {
      userId_domainId: {
        userId: applicationDomain.application.applicantUserId,
        domainId: applicationDomain.domainId,
      },
    },
    update: {
      approvedApplicationDomainId: applicationDomain.id,
    },
    create: {
      userId: applicationDomain.application.applicantUserId,
      domainId: applicationDomain.domainId,
      approvedApplicationDomainId: applicationDomain.id,
    },
  });

  await syncBuddyApplicationStatus(tx, applicationDomain.application.id);
}

export async function rejectBuddyApplicationDomain(
  tx: Prisma.TransactionClient,
  applicationDomainId: string,
  adminUserId: string,
) {
  const applicationDomain = await tx.buddyApplicationDomain.findUnique({
    where: { id: applicationDomainId },
    select: { id: true, applicationId: true },
  });

  if (!applicationDomain) {
    throw new Error("Buddy application domain not found.");
  }

  await tx.buddyApplicationDomain.update({
    where: { id: applicationDomain.id },
    data: {
      status: BuddyApplicationDomainStatus.REJECTED,
      rejectedAt: new Date(),
      adminReviewedAt: new Date(),
      rejectedByAdminId: adminUserId,
    },
  });

  await syncBuddyApplicationStatus(tx, applicationDomain.applicationId);
}

export async function closeBuddyConversationById(
  tx: Prisma.TransactionClient,
  conversationId: string,
  nextStatus: ConversationStatus = ConversationStatus.CLOSED,
) {
  const conversation = await tx.conversation.findFirst({
    where: { id: conversationId, kind: ConversationKind.BUDDY_SUPPORT },
    select: { id: true, buddyRequestId: true },
  });

  if (!conversation) {
    return;
  }

  await tx.conversation.update({
    where: { id: conversation.id },
    data: { status: nextStatus },
  });

  await tx.buddyVideoConsent.updateMany({
    where: {
      conversationId: conversation.id,
      status: { in: [ConsentStatus.PENDING, ConsentStatus.APPROVED] },
    },
    data: {
      status: ConsentStatus.REVOKED,
      respondedAt: new Date(),
    },
  });

  await tx.videoCallRecord.updateMany({
    where: { conversationId: conversation.id, endedAt: null },
    data: { endedAt: new Date(), activeConversationKey: null },
  });

  if (conversation.buddyRequestId) {
    await tx.buddyRequest.updateMany({
      where: { id: conversation.buddyRequestId, status: { in: [BuddyRequestStatus.ASSIGNED, BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION] } },
      data: { status: BuddyRequestStatus.CLOSED, closedAt: new Date() },
    });
  }
}

export async function invalidateBuddyByBlock(
  tx: Prisma.TransactionClient,
  blockerUserId: string,
  blockedUserId: string,
) {
  await tx.buddyRequestAssignment.updateMany({
    where: {
      status: BuddyRequestAssignmentStatus.PENDING,
      OR: [
        { buddyId: blockerUserId, buddyRequest: { seekerId: blockedUserId } },
        { buddyId: blockedUserId, buddyRequest: { seekerId: blockerUserId } },
      ],
    },
    data: { status: BuddyRequestAssignmentStatus.NOT_RELEVANT, respondedAt: new Date() },
  });

  await tx.buddyRequest.updateMany({
    where: {
      status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION] },
      OR: [
        { seekerId: blockerUserId, assignments: { some: { buddyId: blockedUserId } } },
        { seekerId: blockedUserId, assignments: { some: { buddyId: blockerUserId } } },
      ],
    },
    data: { status: BuddyRequestStatus.CANCELLED, closedAt: new Date() },
  });

  const buddyConversations = await tx.conversation.findMany({
    where: {
      kind: ConversationKind.BUDDY_SUPPORT,
      status: ConversationStatus.ACTIVE,
      OR: [
        { userOneId: blockerUserId, userTwoId: blockedUserId },
        { userOneId: blockedUserId, userTwoId: blockerUserId },
      ],
    },
    select: { id: true },
  });

  for (const conversation of buddyConversations) {
    await closeBuddyConversationById(tx, conversation.id, ConversationStatus.BLOCKED);
  }
}

export async function refreshBuddyRequestState(tx: Prisma.TransactionClient, requestId: string) {
  const request = await tx.buddyRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      seekerId: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      assignments: {
        select: { id: true, status: true },
      },
    },
  });

  if (!request) {
    return { status: null, notificationIds: [] as string[] };
  }

  const now = new Date();
  const notificationIds: string[] = [];
  const autoCancelAt = getBuddyAutoCancelDeadline(request.createdAt);
  const allAssignmentsResolved = request.assignments.length > 0 && request.assignments.every((assignment) => assignment.status !== BuddyRequestAssignmentStatus.PENDING);

  if (request.status === BuddyRequestStatus.AWAITING_SEEKER_DECISION && now >= autoCancelAt) {
    await tx.buddyRequest.update({
      where: { id: request.id },
      data: { status: BuddyRequestStatus.CANCELLED, closedAt: now },
    });
    const notification = await createNotificationRecord(tx, request.seekerId, NotificationType.BUDDY_REQUEST_CANCELLED, {
      buddyRequestId: request.id,
      reason: "expired",
    });
    notificationIds.push(notification.id);
    return { status: BuddyRequestStatus.CANCELLED, notificationIds };
  }

  if (request.status === BuddyRequestStatus.PENDING && (now >= request.expiresAt || allAssignmentsResolved)) {
    await tx.buddyRequest.update({
      where: { id: request.id },
      data: {
        status: BuddyRequestStatus.AWAITING_SEEKER_DECISION,
        extensionPromptAt: now,
      },
    });
    const notification = await createNotificationRecord(tx, request.seekerId, NotificationType.BUDDY_REQUEST_DECISION_NEEDED, {
      buddyRequestId: request.id,
    });
    notificationIds.push(notification.id);
    return { status: BuddyRequestStatus.AWAITING_SEEKER_DECISION, notificationIds };
  }

  return { status: request.status, notificationIds };
}

export async function refreshBuddyStateForUser(userId: string) {
  const requestIds = await prisma.buddyRequest.findMany({
    where: {
      OR: [{ seekerId: userId }, { assignments: { some: { buddyId: userId } } }],
      status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION] },
    },
    select: { id: true },
  });

  const notificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const request of requestIds) {
      const refreshed = await refreshBuddyRequestState(tx, request.id);
      notificationIds.push(...refreshed.notificationIds);
    }
  });

  if (notificationIds.length > 0) {
    await deliverNotifications(notificationIds);
  }
}

import {
  BuddyRequestAssignmentStatus,
  BuddyRequestStatus,
  BuddySupportMode,
  BuddyDomain,
  ConsentStatus,
  ConversationKind,
  ConversationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createNotificationRecord, deliverNotifications } from "@/lib/notifications";

export const BUDDY_REQUEST_WINDOW_HOURS = 48;
export const BUDDY_AUTO_CANCEL_DAYS = 5;

export const BUDDY_DOMAIN_OPTIONS: Array<{ value: BuddyDomain; label: string }> = [
  { value: BuddyDomain.DIVORCE_SUPPORT, label: "Divorce support" },
  { value: BuddyDomain.EMOTIONAL_SUPPORT, label: "Emotional support" },
  { value: BuddyDomain.STARTING_OVER, label: "Starting over / rebuilding life" },
  { value: BuddyDomain.DATING_AFTER_DIVORCE, label: "Dating after divorce" },
  { value: BuddyDomain.BDSM_GUIDANCE, label: "BDSM lifestyle guidance" },
  { value: BuddyDomain.RELATIONSHIP_SUPPORT, label: "Relationship support" },
  { value: BuddyDomain.SOMEONE_TO_TALK_TO, label: "Someone to talk to" },
];

export const BUDDY_SUPPORT_MODE_OPTIONS: Array<{ value: BuddySupportMode; label: string }> = [
  { value: BuddySupportMode.CHAT_ONLY, label: "Chat only" },
  { value: BuddySupportMode.VIDEO_OK, label: "Video okay" },
  { value: BuddySupportMode.EITHER, label: "Either" },
];

export function getBuddyRequestDeadline(base = new Date()) {
  return new Date(base.getTime() + BUDDY_REQUEST_WINDOW_HOURS * 60 * 60 * 1000);
}

export function getBuddyAutoCancelDeadline(base = new Date()) {
  return new Date(base.getTime() + BUDDY_AUTO_CANCEL_DAYS * 24 * 60 * 60 * 1000);
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
      extensionPromptAt: true,
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

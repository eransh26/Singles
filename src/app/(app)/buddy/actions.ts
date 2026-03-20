"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AccountStatus,
  BuddyAvailabilityLevel,
  BuddyRequestAssignmentStatus,
  BuddyRequestStatus,
  BuddySupportMode,
  ConsentStatus,
  ConversationKind,
  ConversationStatus,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  BUDDY_MAX_TEXT_LENGTH,
  closeBuddyConversationById,
  ensureBuddyDomainsSeeded,
  getBuddyRequestCooldownDeadline,
  getBuddyRequestDeadline,
  invalidateBuddyByBlock,
  refreshBuddyRequestState,
  refreshBuddyStateForUser,
} from "@/lib/buddy";
import { createNotificationRecord, deliverNotifications } from "@/lib/notifications";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalTextValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function withSavedParam(path: string, saved: string) {
  return path.includes("?") ? `${path}&saved=${saved}` : `${path}?saved=${saved}`;
}

async function getBuddyDomainById(domainId: string) {
  return prisma.buddyDomainRecord.findUnique({
    where: { id: domainId },
    select: { id: true, name: true, slug: true, isActive: true },
  });
}

function isBuddyAvailabilityLevel(value: string): value is BuddyAvailabilityLevel {
  return Object.values(BuddyAvailabilityLevel).includes(value as BuddyAvailabilityLevel);
}

function buddyPairKey(requestId: string) {
  return `buddy:${requestId}`;
}

async function createNotification(tx: Prisma.TransactionClient, userId: string, type: NotificationType, payloadJson: Prisma.InputJsonValue) {
  return createNotificationRecord(tx, userId, type, payloadJson);
}

async function getEligibleBuddyIds(tx: Prisma.TransactionClient, seekerId: string, domainId: string) {
  const candidateProfiles = await tx.buddyProfileDomain.findMany({
    where: {
      domainId,
      domain: { isActive: true },
      profile: {
        isAvailable: true,
        user: {
          id: { not: seekerId },
          accountStatus: AccountStatus.ACTIVE,
          role: UserRole.USER,
        },
      },
    },
    select: { userId: true },
  });

  const candidateIds = Array.from(new Set(candidateProfiles.map((entry) => entry.userId)));
  if (candidateIds.length === 0) {
    return [] as string[];
  }

  const blocks = await tx.userBlock.findMany({
    where: {
      OR: [
        { blockerUserId: seekerId, blockedUserId: { in: candidateIds } },
        { blockerUserId: { in: candidateIds }, blockedUserId: seekerId },
      ],
    },
    select: { blockerUserId: true, blockedUserId: true },
  });

  const blockedIds = new Set(
    blocks.map((block) => (block.blockerUserId === seekerId ? block.blockedUserId : block.blockerUserId)),
  );

  return candidateIds.filter((candidateId) => !blockedIds.has(candidateId));
}

function revalidateBuddyPaths(conversationId?: string | null) {
  revalidatePath("/buddy");
  revalidatePath("/home");
  revalidatePath("/settings");
  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/admin/buddy");
  if (conversationId) {
    revalidatePath(`/buddy/${conversationId}`);
    revalidatePath(`/buddy/video/${conversationId}`);
  }
}

export async function updateBuddyProfileAction(formData: FormData) {
  const user = await requireActiveUser();
  const isAvailable = formData.get("isBuddyAvailable") === "on";
  const intro = optionalTextValue(formData, "buddyIntro");
  const availabilityLevelValue = optionalTextValue(formData, "buddyAvailabilityLevel");
  const availabilityLevel = availabilityLevelValue && isBuddyAvailabilityLevel(availabilityLevelValue)
    ? availabilityLevelValue
    : null;

  if (intro && intro.length > BUDDY_MAX_TEXT_LENGTH) {
    throw new Error(`Buddy intro must be ${BUDDY_MAX_TEXT_LENGTH} characters or fewer.`);
  }

  const approvedDomainCount = await prisma.buddyProfileDomain.count({ where: { userId: user.id } });

  if (isAvailable) {
    if (approvedDomainCount === 0) {
      throw new Error("You need at least one approved Buddy domain before making yourself available.");
    }
    if (!user.emailVerified || !user.phoneVerifiedAt) {
      throw new Error("Complete email and phone verification before becoming available as a Buddy.");
    }
    if (!availabilityLevel) {
      throw new Error("Choose an availability level before making yourself available as a Buddy.");
    }
    if (!intro) {
      throw new Error("Add a short Buddy introduction before making yourself available.");
    }
  }

  await prisma.buddyProfile.upsert({
    where: { userId: user.id },
    update: {
      isAvailable,
      intro,
      availabilityLevel,
    },
    create: {
      userId: user.id,
      isAvailable,
      intro,
      availabilityLevel,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/buddy");
  redirect("/settings?saved=buddy");
}

export async function createBuddyRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  await ensureBuddyDomainsSeeded();
  const domainId = textValue(formData, "domainId");
  const message = optionalTextValue(formData, "message");
  const domain = await getBuddyDomainById(domainId);

  if (!domain || !domain.isActive) {
    throw new Error("Choose a support domain.");
  }

  if (message && message.length > BUDDY_MAX_TEXT_LENGTH) {
    throw new Error(`Buddy request messages must stay under ${BUDDY_MAX_TEXT_LENGTH} characters.`);
  }

  const [existingOpenRequest, recentCancelledRequest] = await Promise.all([
    prisma.buddyRequest.findFirst({
      where: {
        seekerId: user.id,
        status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.buddyRequest.findFirst({
      where: {
        seekerId: user.id,
        status: BuddyRequestStatus.CANCELLED,
        closedAt: { not: null },
      },
      orderBy: { closedAt: "desc" },
      select: { closedAt: true },
    }),
  ]);

  if (existingOpenRequest) {
    redirect(withSavedParam("/buddy", "request-already-open"));
  }

  if (recentCancelledRequest?.closedAt) {
    const cooldownUntil = getBuddyRequestCooldownDeadline(recentCancelledRequest.closedAt);
    if (cooldownUntil > new Date()) {
      redirect(`/buddy?saved=request-cooldown&cooldownUntil=${encodeURIComponent(cooldownUntil.toISOString())}`);
    }
  }

  const notificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const eligibleBuddyIds = await getEligibleBuddyIds(tx, user.id, domainId);
    const buddyRequest = await tx.buddyRequest.create({
      data: {
        seekerId: user.id,
        domainId,
        message,
        preferredMode: BuddySupportMode.CHAT_ONLY,
        status: BuddyRequestStatus.PENDING,
        expiresAt: getBuddyRequestDeadline(),
      },
      select: { id: true },
    });

    if (eligibleBuddyIds.length > 0) {
      await tx.buddyRequestAssignment.createMany({
        data: eligibleBuddyIds.map((buddyId) => ({
          buddyRequestId: buddyRequest.id,
          buddyId,
          status: BuddyRequestAssignmentStatus.PENDING,
        })),
        skipDuplicates: true,
      });

      for (const buddyId of eligibleBuddyIds) {
        const notification = await createNotification(tx, buddyId, NotificationType.BUDDY_REQUEST_INCOMING, {
          buddyRequestId: buddyRequest.id,
          seekerDisplayName: user.displayName,
          domainId,
        });
        notificationIds.push(notification.id);
      }
    }

    const submittedNotification = await createNotification(tx, user.id, NotificationType.BUDDY_REQUEST_SUBMITTED, {
      buddyRequestId: buddyRequest.id,
      domainId,
    });
    notificationIds.push(submittedNotification.id);
  });

  await deliverNotifications(notificationIds);
  revalidateBuddyPaths();
  redirect("/buddy?saved=request-submitted");
}

export async function reviewBuddyAssignmentAction(formData: FormData) {
  const user = await requireActiveUser();
  const assignmentId = textValue(formData, "assignmentId");
  const decision = textValue(formData, "decision");

  const assignment = await prisma.buddyRequestAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      buddyId: true,
      status: true,
      buddyRequest: {
        select: {
          id: true,
          seekerId: true,
          status: true,
        },
      },
    },
  });

  if (!assignment || assignment.buddyId !== user.id) {
    throw new Error("Buddy request not found.");
  }

  if (assignment.status !== BuddyRequestAssignmentStatus.PENDING) {
    redirect(withSavedParam("/buddy", "request-unavailable"));
  }

  if (decision === "decline") {
    const declineNotificationIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      await tx.buddyRequestAssignment.update({
        where: { id: assignment.id },
        data: {
          status: BuddyRequestAssignmentStatus.DECLINED,
          respondedAt: new Date(),
        },
      });

      const refreshed = await refreshBuddyRequestState(tx, assignment.buddyRequest.id);
      declineNotificationIds.push(...refreshed.notificationIds);
    });

    await deliverNotifications(declineNotificationIds);
    revalidateBuddyPaths();
    redirect("/buddy?saved=request-declined");
  }

  let conversationId: string | null = null;
  const acceptNotificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const freshAssignment = await tx.buddyRequestAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        buddyId: true,
        status: true,
        buddyRequest: {
          select: {
            id: true,
            seekerId: true,
            assignedBuddyId: true,
            status: true,
            domainId: true,
            domain: { select: { name: true } },
            preferredMode: true,
          },
        },
      },
    });

    if (!freshAssignment || freshAssignment.buddyId !== user.id || freshAssignment.status !== BuddyRequestAssignmentStatus.PENDING) {
      throw new Error("This Buddy request is no longer available.");
    }

    const blocked = await tx.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: user.id, blockedUserId: freshAssignment.buddyRequest.seekerId },
          { blockerUserId: freshAssignment.buddyRequest.seekerId, blockedUserId: user.id },
        ],
      },
      select: { id: true },
    });

    if (blocked) {
      throw new Error("This Buddy request is no longer available.");
    }

    const claimed = await tx.buddyRequest.updateMany({
      where: {
        id: freshAssignment.buddyRequest.id,
        status: BuddyRequestStatus.PENDING,
        assignedBuddyId: null,
      },
      data: {
        status: BuddyRequestStatus.ASSIGNED,
        assignedBuddyId: user.id,
      },
    });

    if (claimed.count === 0) {
      throw new Error("Another Buddy already accepted this request.");
    }

    await tx.buddyRequestAssignment.update({
      where: { id: freshAssignment.id },
      data: {
        status: BuddyRequestAssignmentStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    const staleAssignments = await tx.buddyRequestAssignment.findMany({
      where: {
        buddyRequestId: freshAssignment.buddyRequest.id,
        id: { not: freshAssignment.id },
        status: BuddyRequestAssignmentStatus.PENDING,
      },
      select: { buddyId: true },
    });

    await tx.buddyRequestAssignment.updateMany({
      where: {
        buddyRequestId: freshAssignment.buddyRequest.id,
        id: { not: freshAssignment.id },
        status: BuddyRequestAssignmentStatus.PENDING,
      },
      data: {
        status: BuddyRequestAssignmentStatus.NOT_RELEVANT,
        respondedAt: new Date(),
      },
    });

    const seekerId = freshAssignment.buddyRequest.seekerId;
    const sortedParticipants = [seekerId, user.id].sort();
    const conversation = await tx.conversation.create({
      data: {
        userOneId: sortedParticipants[0],
        userTwoId: sortedParticipants[1],
        pairKey: buddyPairKey(freshAssignment.buddyRequest.id),
        kind: ConversationKind.BUDDY_SUPPORT,
        status: ConversationStatus.ACTIVE,
        buddyRequestId: freshAssignment.buddyRequest.id,
      },
      select: { id: true },
    });

    conversationId = conversation.id;

    const assignedNotification = await createNotification(tx, seekerId, NotificationType.BUDDY_REQUEST_ASSIGNED, {
      buddyRequestId: freshAssignment.buddyRequest.id,
      buddyId: user.id,
      buddyDisplayName: user.displayName,
      conversationId: conversation.id,
    });
    acceptNotificationIds.push(assignedNotification.id);

    for (const staleAssignment of staleAssignments) {
      const staleNotification = await createNotification(tx, staleAssignment.buddyId, NotificationType.BUDDY_REQUEST_NO_LONGER_RELEVANT, {
        buddyRequestId: freshAssignment.buddyRequest.id,
      });
      acceptNotificationIds.push(staleNotification.id);
    }
  });

  await deliverNotifications(acceptNotificationIds);
  revalidateBuddyPaths(conversationId);
  redirect(`/buddy/${conversationId}?saved=assigned`);
}

export async function extendBuddyRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const buddyRequestId = textValue(formData, "buddyRequestId");
  const notificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const request = await tx.buddyRequest.findUnique({
      where: { id: buddyRequestId },
      select: {
        id: true,
        seekerId: true,
        domainId: true,
        domain: { select: { name: true } },
        status: true,
        assignments: { select: { buddyId: true } },
      },
    });

    if (!request || request.seekerId !== user.id) {
      throw new Error("Buddy request not found.");
    }

    if (request.status !== BuddyRequestStatus.AWAITING_SEEKER_DECISION && request.status !== BuddyRequestStatus.PENDING) {
      throw new Error("This Buddy request can no longer be extended.");
    }

    await tx.buddyRequest.update({
      where: { id: request.id },
      data: {
        status: BuddyRequestStatus.PENDING,
        expiresAt: getBuddyRequestDeadline(),
        extendedAt: new Date(),
        extensionPromptAt: null,
        closedAt: null,
      },
    });

    const existingBuddyIds = new Set(request.assignments.map((assignment) => assignment.buddyId));
    const eligibleBuddyIds = await getEligibleBuddyIds(tx, user.id, request.domainId);
    const newBuddyIds = eligibleBuddyIds.filter((buddyId) => !existingBuddyIds.has(buddyId));

    if (newBuddyIds.length > 0) {
      await tx.buddyRequestAssignment.createMany({
        data: newBuddyIds.map((buddyId) => ({
          buddyRequestId: request.id,
          buddyId,
          status: BuddyRequestAssignmentStatus.PENDING,
        })),
        skipDuplicates: true,
      });

      for (const buddyId of newBuddyIds) {
        const notification = await createNotification(tx, buddyId, NotificationType.BUDDY_REQUEST_INCOMING, {
          buddyRequestId: request.id,
          seekerDisplayName: user.displayName,
          domainName: request.domain.name,
        });
        notificationIds.push(notification.id);
      }
    }
  });

  await deliverNotifications(notificationIds);
  revalidateBuddyPaths();
  redirect("/buddy?saved=request-extended");
}

export async function cancelBuddyRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const buddyRequestId = textValue(formData, "buddyRequestId");

  await prisma.$transaction(async (tx) => {
    const request = await tx.buddyRequest.findUnique({
      where: { id: buddyRequestId },
      select: { id: true, seekerId: true, status: true, assignments: { select: { buddyId: true, status: true } } },
    });

    if (!request || request.seekerId !== user.id) {
      throw new Error("Buddy request not found.");
    }

    if (request.status !== BuddyRequestStatus.PENDING && request.status !== BuddyRequestStatus.AWAITING_SEEKER_DECISION) {
      throw new Error("This Buddy request can no longer be cancelled.");
    }

    await tx.buddyRequest.update({
      where: { id: request.id },
      data: { status: BuddyRequestStatus.CANCELLED, closedAt: new Date() },
    });

    await tx.buddyRequestAssignment.updateMany({
      where: { buddyRequestId: request.id, status: BuddyRequestAssignmentStatus.PENDING },
      data: { status: BuddyRequestAssignmentStatus.NOT_RELEVANT, respondedAt: new Date() },
    });

    for (const assignment of request.assignments.filter((item) => item.status === BuddyRequestAssignmentStatus.PENDING)) {
      await createNotification(tx, assignment.buddyId, NotificationType.BUDDY_REQUEST_NO_LONGER_RELEVANT, {
        buddyRequestId: request.id,
      });
    }

    await createNotification(tx, user.id, NotificationType.BUDDY_REQUEST_CANCELLED, {
      buddyRequestId: request.id,
      reason: "cancelled",
    });
  });

  revalidateBuddyPaths();
  redirect("/buddy?saved=request-cancelled");
}

export async function requestBuddyVideoConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const conversationId = textValue(formData, "conversationId");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      kind: true,
      status: true,
      userOneId: true,
      userTwoId: true,
    },
  });

  if (!conversation || conversation.kind !== ConversationKind.BUDDY_SUPPORT || conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("Buddy video requests require an active Buddy conversation.");
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant) {
    throw new Error("Buddy video requests are not available for this conversation.");
  }

  const targetUserId = conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId;
  const existingConsent = await prisma.buddyVideoConsent.findUnique({
    where: { conversationId },
    select: { status: true },
  });

  if (existingConsent?.status === ConsentStatus.APPROVED) {
    redirect(`/buddy/${conversationId}`);
  }

  if (existingConsent?.status === ConsentStatus.PENDING) {
    redirect(withSavedParam(`/buddy/${conversationId}`, "video-request"));
  }

  const notificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.buddyVideoConsent.upsert({
      where: { conversationId },
      update: {
        requesterUserId: user.id,
        targetUserId,
        approvedByUserId: null,
        status: ConsentStatus.PENDING,
        respondedAt: null,
      },
      create: {
        conversationId,
        requesterUserId: user.id,
        targetUserId,
        status: ConsentStatus.PENDING,
      },
    });

    const notification = await createNotification(tx, targetUserId, NotificationType.BUDDY_VIDEO_REQUEST_INCOMING, {
      conversationId,
      requesterUserId: user.id,
      requesterDisplayName: user.displayName,
    });
    notificationIds.push(notification.id);
  });

  await deliverNotifications(notificationIds);
  revalidateBuddyPaths(conversationId);
  redirect(withSavedParam(`/buddy/${conversationId}`, "video-request"));
}

export async function reviewBuddyVideoConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const consentId = textValue(formData, "consentId");
  const decision = textValue(formData, "decision");

  const consent = await prisma.buddyVideoConsent.findUnique({
    where: { id: consentId },
    select: {
      id: true,
      conversationId: true,
      requesterUserId: true,
      targetUserId: true,
      status: true,
      conversation: {
        select: {
          id: true,
          kind: true,
          status: true,
          userOneId: true,
          userTwoId: true,
        },
      },
    },
  });

  if (!consent || consent.targetUserId !== user.id || consent.status !== ConsentStatus.PENDING) {
    throw new Error("Buddy video request not found.");
  }

  const isParticipant = consent.conversation.userOneId === user.id || consent.conversation.userTwoId === user.id;
  if (!isParticipant || consent.conversation.kind !== ConversationKind.BUDDY_SUPPORT || consent.conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("Buddy video request not found.");
  }

  const nextStatus = decision === "approve" ? ConsentStatus.APPROVED : ConsentStatus.DECLINED;
  const approvalNotificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.buddyVideoConsent.update({
      where: { id: consent.id },
      data: {
        status: nextStatus,
        approvedByUserId: nextStatus === ConsentStatus.APPROVED ? user.id : null,
        respondedAt: new Date(),
      },
    });

    if (nextStatus === ConsentStatus.APPROVED) {
      const notification = await createNotification(tx, consent.requesterUserId, NotificationType.BUDDY_VIDEO_REQUEST_APPROVED, {
        conversationId: consent.conversationId,
        approverUserId: user.id,
        approverDisplayName: user.displayName,
      });
      approvalNotificationIds.push(notification.id);
    }
  });

  await deliverNotifications(approvalNotificationIds);
  revalidateBuddyPaths(consent.conversationId);
  redirect(withSavedParam(`/buddy/${consent.conversationId}`, nextStatus === ConsentStatus.APPROVED ? "video-approved" : "video-declined"));
}

export async function revokeBuddyVideoConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const conversationId = textValue(formData, "conversationId");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      kind: true,
      userOneId: true,
      userTwoId: true,
    },
  });

  if (!conversation || conversation.kind !== ConversationKind.BUDDY_SUPPORT) {
    throw new Error("Buddy conversation not found.");
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant) {
    throw new Error("Buddy video access cannot be changed.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.buddyVideoConsent.updateMany({
      where: { conversationId, status: { in: [ConsentStatus.PENDING, ConsentStatus.APPROVED] } },
      data: {
        status: ConsentStatus.REVOKED,
        approvedByUserId: user.id,
        respondedAt: new Date(),
      },
    });

    await tx.videoCallRecord.updateMany({
      where: { conversationId, endedAt: null },
      data: {
        endedAt: new Date(),
        activeConversationKey: null,
      },
    });
  });

  revalidateBuddyPaths(conversationId);
  redirect(withSavedParam(`/buddy/${conversationId}`, "video-revoked"));
}

export async function endBuddyConversationAction(formData: FormData) {
  const user = await requireActiveUser();
  const conversationId = textValue(formData, "conversationId");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      kind: true,
      status: true,
      userOneId: true,
      userTwoId: true,
    },
  });

  if (!conversation || conversation.kind !== ConversationKind.BUDDY_SUPPORT) {
    throw new Error("Buddy conversation not found.");
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant || conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("This Buddy connection is no longer active.");
  }

  const otherUserId = conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId;

  await prisma.$transaction(async (tx) => {
    await closeBuddyConversationById(tx, conversationId, ConversationStatus.CLOSED);
    await createNotification(tx, otherUserId, NotificationType.BUDDY_REQUEST_CANCELLED, {
      conversationId,
      reason: "ended",
      actorUserId: user.id,
      actorDisplayName: user.displayName,
    });
  });

  revalidateBuddyPaths(conversationId);
  redirect("/buddy?saved=connection-ended");
}

export async function blockBuddyUserAction(formData: FormData) {
  const user = await requireActiveUser();
  const blockedUserId = textValue(formData, "blockedUserId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/buddy";
  const reason = optionalTextValue(formData, "reason") ?? "Blocked from Buddy support";

  if (!blockedUserId || blockedUserId === user.id) {
    throw new Error("Choose another member to block.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userBlock.upsert({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: user.id,
          blockedUserId,
        },
      },
      update: { reason },
      create: {
        blockerUserId: user.id,
        blockedUserId,
        reason,
      },
    });

    await invalidateBuddyByBlock(tx, user.id, blockedUserId);
  });

  revalidateBuddyPaths();
  redirect(withSavedParam(sourcePath, "buddy-blocked"));
}

export async function primeBuddyStateAction() {
  const user = await requireActiveUser();
  await refreshBuddyStateForUser(user.id);
}



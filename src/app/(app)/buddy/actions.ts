"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AccountStatus,
  BuddyAvailabilityLevel,
  BuddyDomain,
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
  BUDDY_DOMAIN_OPTIONS,
  BUDDY_SUPPORT_MODE_OPTIONS,
  closeBuddyConversationById,
  getBuddyRequestDeadline,
  invalidateBuddyByBlock,
  refreshBuddyRequestState,
  refreshBuddyStateForUser,
} from "@/lib/buddy";

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

function isBuddyDomain(value: string): value is BuddyDomain {
  return BUDDY_DOMAIN_OPTIONS.some((option) => option.value === value);
}

function isBuddySupportMode(value: string): value is BuddySupportMode {
  return BUDDY_SUPPORT_MODE_OPTIONS.some((option) => option.value === value);
}

function isBuddyAvailabilityLevel(value: string): value is BuddyAvailabilityLevel {
  return Object.values(BuddyAvailabilityLevel).includes(value as BuddyAvailabilityLevel);
}

function buddyPairKey(requestId: string) {
  return `buddy:${requestId}`;
}

async function createNotification(tx: Prisma.TransactionClient, userId: string, type: NotificationType, payloadJson: Prisma.InputJsonValue) {
  await tx.notification.create({
    data: {
      userId,
      type,
      payloadJson,
    },
  });
}

async function getEligibleBuddyIds(tx: Prisma.TransactionClient, seekerId: string, domain: BuddyDomain) {
  const candidateProfiles = await tx.buddyProfileDomain.findMany({
    where: {
      domain,
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
  const domains = formData
    .getAll("buddyDomains")
    .map((value) => String(value))
    .filter(isBuddyDomain);

  if (intro && intro.length > 280) {
    throw new Error("Buddy intro must be 280 characters or fewer.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.buddyProfile.upsert({
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

    await tx.buddyProfileDomain.deleteMany({ where: { userId: user.id } });

    if (domains.length > 0) {
      await tx.buddyProfileDomain.createMany({
        data: domains.map((domain) => ({ userId: user.id, domain })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/buddy");
  redirect("/settings?saved=buddy");
}

export async function createBuddyRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const domainValue = textValue(formData, "domain");
  const preferredModeValue = textValue(formData, "preferredMode");
  const message = optionalTextValue(formData, "message");

  if (!isBuddyDomain(domainValue)) {
    throw new Error("Choose a support domain.");
  }

  if (!isBuddySupportMode(preferredModeValue)) {
    throw new Error("Choose a support preference.");
  }

  if (message && message.length > 500) {
    throw new Error("Buddy request messages must stay under 500 characters.");
  }

  const existingOpenRequest = await prisma.buddyRequest.findFirst({
    where: {
      seekerId: user.id,
      domain: domainValue,
      status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] },
    },
    select: { id: true },
  });

  if (existingOpenRequest) {
    redirect(withSavedParam("/buddy", "request-already-open"));
  }

  await prisma.$transaction(async (tx) => {
    const eligibleBuddyIds = await getEligibleBuddyIds(tx, user.id, domainValue);
    const buddyRequest = await tx.buddyRequest.create({
      data: {
        seekerId: user.id,
        domain: domainValue,
        message,
        preferredMode: preferredModeValue,
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
        await createNotification(tx, buddyId, NotificationType.BUDDY_REQUEST_INCOMING, {
          buddyRequestId: buddyRequest.id,
          seekerDisplayName: user.displayName,
          domain: domainValue,
        });
      }
    }

    await createNotification(tx, user.id, NotificationType.BUDDY_REQUEST_SUBMITTED, {
      buddyRequestId: buddyRequest.id,
      domain: domainValue,
    });
  });

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
    await prisma.$transaction(async (tx) => {
      await tx.buddyRequestAssignment.update({
        where: { id: assignment.id },
        data: {
          status: BuddyRequestAssignmentStatus.DECLINED,
          respondedAt: new Date(),
        },
      });

      await refreshBuddyRequestState(tx, assignment.buddyRequest.id);
    });

    revalidateBuddyPaths();
    redirect("/buddy?saved=request-declined");
  }

  let conversationId: string | null = null;

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
            domain: true,
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

    await createNotification(tx, seekerId, NotificationType.BUDDY_REQUEST_ASSIGNED, {
      buddyRequestId: freshAssignment.buddyRequest.id,
      buddyId: user.id,
      buddyDisplayName: user.displayName,
      conversationId: conversation.id,
    });

    for (const staleAssignment of staleAssignments) {
      await createNotification(tx, staleAssignment.buddyId, NotificationType.BUDDY_REQUEST_NO_LONGER_RELEVANT, {
        buddyRequestId: freshAssignment.buddyRequest.id,
      });
    }
  });

  revalidateBuddyPaths(conversationId);
  redirect(`/buddy/${conversationId}?saved=assigned`);
}

export async function extendBuddyRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const buddyRequestId = textValue(formData, "buddyRequestId");

  await prisma.$transaction(async (tx) => {
    const request = await tx.buddyRequest.findUnique({
      where: { id: buddyRequestId },
      select: {
        id: true,
        seekerId: true,
        domain: true,
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
    const eligibleBuddyIds = await getEligibleBuddyIds(tx, user.id, request.domain);
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
        await createNotification(tx, buddyId, NotificationType.BUDDY_REQUEST_INCOMING, {
          buddyRequestId: request.id,
          seekerDisplayName: user.displayName,
          domain: request.domain,
        });
      }
    }
  });

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

    await createNotification(tx, targetUserId, NotificationType.BUDDY_VIDEO_REQUEST_INCOMING, {
      conversationId,
      requesterUserId: user.id,
      requesterDisplayName: user.displayName,
    });
  });

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
      await createNotification(tx, consent.requesterUserId, NotificationType.BUDDY_VIDEO_REQUEST_APPROVED, {
        conversationId: consent.conversationId,
        approverUserId: user.id,
        approverDisplayName: user.displayName,
      });
    }
  });

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



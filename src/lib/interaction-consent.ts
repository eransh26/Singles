import { ConsentStatus, ConversationStatus, PhotoAccessRequestStatus, Prisma } from "@prisma/client";

export function userPairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

export function isVideoConsentActive(status: ConsentStatus | null | undefined) {
  return status === ConsentStatus.APPROVED;
}

export async function revokeVideoConsentForPair(tx: Prisma.TransactionClient, pairKey: string, approvedByUserId?: string | null) {
  await tx.videoConsent.updateMany({
    where: {
      pairKey,
      status: { in: [ConsentStatus.PENDING, ConsentStatus.APPROVED] },
    },
    data: {
      status: ConsentStatus.REVOKED,
      approvedByUserId: approvedByUserId ?? null,
      respondedAt: new Date(),
    },
  });
}

export async function endOpenVideoCallsForConversation(tx: Prisma.TransactionClient, conversationId: string) {
  await tx.videoCallRecord.updateMany({
    where: {
      conversationId,
      endedAt: null,
    },
    data: {
      endedAt: new Date(),
      activeConversationKey: null,
    },
  });
}

export async function revokeChatConversationByPair(
  tx: Prisma.TransactionClient,
  pairKey: string,
  nextStatus: ConversationStatus,
  actorUserId?: string | null,
) {
  const conversation = await tx.conversation.findUnique({
    where: { pairKey },
    select: { id: true, status: true },
  });

  if (conversation && conversation.status !== nextStatus) {
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { status: nextStatus },
    });

    await endOpenVideoCallsForConversation(tx, conversation.id);
  }

  await revokeVideoConsentForPair(tx, pairKey, actorUserId ?? null);
}

export async function invalidatePairInteractionsByBlock(
  tx: Prisma.TransactionClient,
  pairKey: string,
  blockerUserId: string,
  blockedUserId: string,
) {
  await tx.chatRequest.updateMany({
    where: {
      pairKey,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    data: {
      status: "CANCELED",
      pendingKey: null,
      respondedAt: new Date(),
    },
  });

  await tx.photoAccessRequest.updateMany({
    where: {
      pairKey,
      status: PhotoAccessRequestStatus.PENDING,
    },
    data: {
      status: PhotoAccessRequestStatus.CANCELED,
      pendingKey: null,
      respondedAt: new Date(),
    },
  });

  await tx.photoAccessGrant.updateMany({
    where: {
      ownerUserId: { in: [blockerUserId, blockedUserId] },
      granteeUserId: { in: [blockerUserId, blockedUserId] },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  await revokeChatConversationByPair(tx, pairKey, ConversationStatus.BLOCKED, blockerUserId);
}

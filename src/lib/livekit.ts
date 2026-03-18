import { ConversationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const ACTIVE_CALL_WINDOW_MS = 1000 * 60 * 60 * 2;

export function getConversationRoomName(conversationId: string) {
  return `private-chat-${conversationId}`;
}

export async function getVideoConversationById(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      status: true,
      userOneId: true,
      userTwoId: true,
      userOne: {
        select: {
          id: true,
          displayName: true,
        },
      },
      userTwo: {
        select: {
          id: true,
          displayName: true,
        },
      },
      videoCallRecords: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          roomName: true,
          startedByUserId: true,
          startedAt: true,
          endedAt: true,
          lastJoinedAt: true,
          activeConversationKey: true,
        },
      },
    },
  });
}

export function isAuthorizedVideoParticipant(
  conversation: { userOneId: string; userTwoId: string; status: ConversationStatus },
  userId: string,
) {
  return (
    conversation.status === ConversationStatus.ACTIVE &&
    (conversation.userOneId === userId || conversation.userTwoId === userId)
  );
}

export function isJoinableCallRecord(
  callRecord: { endedAt: Date | null; lastJoinedAt: Date | null; startedAt: Date } | null | undefined,
) {
  if (!callRecord || callRecord.endedAt) {
    return false;
  }

  const reference = callRecord.lastJoinedAt ?? callRecord.startedAt;
  return Date.now() - reference.getTime() <= ACTIVE_CALL_WINDOW_MS;
}

async function expireOpenRecord(recordId: string, tx: Prisma.TransactionClient) {
  await tx.videoCallRecord.update({
    where: { id: recordId },
    data: {
      endedAt: new Date(),
      activeConversationKey: null,
    },
  });
}

export async function createOrJoinVideoCallRecord(conversationId: string, startedByUserId: string) {
  const roomName = getConversationRoomName(conversationId);

  try {
    return await prisma.$transaction(async (tx) => {
      const latestOpenRecord = await tx.videoCallRecord.findFirst({
        where: { conversationId, endedAt: null },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          roomName: true,
          startedAt: true,
          lastJoinedAt: true,
          endedAt: true,
        },
      });

      if (latestOpenRecord && isJoinableCallRecord(latestOpenRecord)) {
        const updatedRecord = await tx.videoCallRecord.update({
          where: { id: latestOpenRecord.id },
          data: { lastJoinedAt: new Date() },
          select: { id: true, roomName: true },
        });

        return { callRecordId: updatedRecord.id, roomName: updatedRecord.roomName, callMode: "join" as const };
      }

      if (latestOpenRecord) {
        await expireOpenRecord(latestOpenRecord.id, tx);
      }

      const createdRecord = await tx.videoCallRecord.create({
        data: {
          conversationId,
          roomName,
          startedByUserId,
          lastJoinedAt: new Date(),
          activeConversationKey: conversationId,
        },
        select: { id: true, roomName: true },
      });

      return { callRecordId: createdRecord.id, roomName: createdRecord.roomName, callMode: "start" as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const openRecord = await prisma.videoCallRecord.findFirst({
        where: { conversationId, endedAt: null },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          roomName: true,
          startedAt: true,
          lastJoinedAt: true,
          endedAt: true,
        },
      });

      if (openRecord && isJoinableCallRecord(openRecord)) {
        const updatedRecord = await prisma.videoCallRecord.update({
          where: { id: openRecord.id },
          data: { lastJoinedAt: new Date() },
          select: { id: true, roomName: true },
        });

        return { callRecordId: updatedRecord.id, roomName: updatedRecord.roomName, callMode: "join" as const };
      }
    }

    throw error;
  }
}

export async function markVideoCallLeft(callRecordId: string) {
  return prisma.videoCallRecord.updateMany({
    where: { id: callRecordId, endedAt: null },
    data: {
      endedAt: new Date(),
      activeConversationKey: null,
    },
  });
}

export type VideoConversationPayload = Prisma.PromiseReturnType<typeof getVideoConversationById>;

import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { isJoinableCallRecord } from "@/lib/livekit";
import { StartVideoCallButton } from "./start-video-call-button";
import { ConversationThread } from "./conversation-thread";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const viewer = await requireUser();
  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userOneId: true,
      userTwoId: true,
      status: true,
      userOne: {
        select: {
          id: true,
          displayName: true,
          verificationStatus: true,
          verifiedBadgeVisible: true,
        },
      },
      userTwo: {
        select: {
          id: true,
          displayName: true,
          verificationStatus: true,
          verifiedBadgeVisible: true,
        },
      },
      videoCallRecords: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          startedAt: true,
          lastJoinedAt: true,
          endedAt: true,
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderUserId: true,
          attachments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              fileName: true,
              mimeType: true,
              byteSize: true,
              storageKey: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    notFound();
  }

  const isParticipant = conversation.userOneId === viewer.id || conversation.userTwoId === viewer.id;
  if (!isParticipant || conversation.status !== "ACTIVE") {
    notFound();
  }

  const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;
  const activeCallRecord = conversation.videoCallRecords[0] ?? null;
  const callMode = isJoinableCallRecord(activeCallRecord) ? "join" : "start";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="lux-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="lux-overline">Conversation</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="lux-title !text-[2.3rem] md:!text-[2.8rem]">{otherUser.displayName}</h1>
              {otherUser.verificationStatus === VerificationStatus.APPROVED && otherUser.verifiedBadgeVisible ? (
                <span className="lux-chip lux-chip-accent">Verified</span>
              ) : null}
            </div>
            <p className="lux-body mt-4">A private thread for a slower, more direct exchange.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <StartVideoCallButton conversationId={conversation.id} mode={callMode} />
            <Link className="lux-button-secondary" href="/chats">Back to chats</Link>
            <Link className="lux-button-subtle" href={`/users/${otherUser.id}`}>View profile</Link>
          </div>
        </div>
      </section>

      <ConversationThread
        conversationId={conversation.id}
        initialMessages={conversation.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
          status: "sent" as const,
        }))}
        otherUserName={otherUser.displayName}
        viewerId={viewer.id}
      />
    </main>
  );
}

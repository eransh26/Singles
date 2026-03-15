import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { sendMessageAction } from "../../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const viewer = await requireUser();
  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userOneId: true,
      userTwoId: true,
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
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderUserId: true,
        },
      },
    },
  });

  if (!conversation) {
    notFound();
  }

  const isParticipant = conversation.userOneId === viewer.id || conversation.userTwoId === viewer.id;
  if (!isParticipant) {
    notFound();
  }

  const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;

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
            <p className="lux-body mt-4">
              A private thread for a slower, more direct exchange. Times are shown in 24-hour format.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link className="lux-button-secondary" href="/chats">Back to chats</Link>
            <Link className="lux-button-subtle" href={`/users/${otherUser.id}`}>View profile</Link>
          </div>
        </div>
      </section>

      <section className="lux-card overflow-hidden">
        <div className="space-y-3">
          {conversation.messages.length === 0 ? (
            <p className="lux-empty">No messages yet. Send the first one below.</p>
          ) : (
            conversation.messages.map((message) => {
              const isMine = message.senderUserId === viewer.id;
              return (
                <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[84%] rounded-[1.6rem] px-4 py-3 text-sm shadow-sm ${
                      isMine
                        ? "border border-[color:rgba(31,26,23,0.06)] bg-[linear-gradient(180deg,rgba(31,26,23,0.98),rgba(24,20,17,0.98))] text-[color:var(--lux-cta-text)] dark:border-[color:rgba(242,229,215,0.08)] dark:bg-[linear-gradient(180deg,rgba(242,229,215,0.96),rgba(228,212,194,0.96))] dark:text-[color:var(--lux-cta-text)] dark:!text-[#1a1512]"
                        : "border border-[color:rgba(179,154,136,0.18)] bg-[color:rgba(255,255,255,0.42)] text-[color:var(--lux-text)] dark:bg-[color:rgba(42,36,31,0.62)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-7">{message.body}</p>
                    <p className={`mt-2 text-[11px] uppercase tracking-[0.14em] ${isMine ? "text-current/70" : "text-[color:var(--lux-text-muted)]"}`}>
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form action={sendMessageAction} className="mt-6 flex flex-col gap-3 border-t lux-divider pt-5">
          <input name="conversationId" type="hidden" value={conversation.id} />
          <textarea
            className="lux-textarea min-h-28"
            name="body"
            placeholder={`Write a message to ${otherUser.displayName}`}
            required
          />
          <div className="flex justify-end">
            <button className="lux-button-primary" type="submit">Send message</button>
          </div>
        </form>
      </section>
    </main>
  );
}

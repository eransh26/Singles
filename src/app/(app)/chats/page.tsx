import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { reviewChatRequestAction } from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { RelativeTime } from "@/components/relative-time";

export default async function ChatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;

  const [conversations, incomingRequests, outgoingRequests] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        OR: [{ userOneId: viewer.id }, { userTwoId: viewer.id }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        updatedAt: true,
        userOneId: true,
        userTwo: {
          select: {
            id: true,
            displayName: true,
            verificationStatus: true,
            verifiedBadgeVisible: true,
          },
        },
        userOne: {
          select: {
            id: true,
            displayName: true,
            verificationStatus: true,
            verifiedBadgeVisible: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            body: true,
            createdAt: true,
            senderUserId: true,
          },
        },
      },
    }),
    prisma.chatRequest.findMany({
      where: { toUserId: viewer.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        fromUser: {
          select: {
            id: true,
            displayName: true,
            verificationStatus: true,
            verifiedBadgeVisible: true,
          },
        },
      },
    }),
    prisma.chatRequest.findMany({
      where: { fromUserId: viewer.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        toUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
  ]);

  const savedMessage = resolvedSearchParams?.saved === "incoming-chat" ? "You already have an incoming request from this member." : null;

  return (
    <main className="lux-shell">
      {savedMessage ? (
        <div className="rounded-[1.25rem] border border-[color:rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] px-4 py-3 text-sm text-[color:var(--lux-success)]">
          {savedMessage}
        </div>
      ) : null}

      <section className="lux-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="lux-overline">Chats</p>
            <h1 className="lux-title mt-3">Direct conversations, kept calm and close.</h1>
            <p className="lux-body mt-4">
              Review requests, continue active conversations, and keep the tone intimate rather than transactional.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <span className="lux-chip">Conversations {conversations.length}</span>
            <span className="lux-chip">Incoming {incomingRequests.length}</span>
            <span className="lux-chip lux-chip-accent">Outgoing {outgoingRequests.length}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Conversations</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Active chats</h2>
          </div>
          <div className="mt-5 space-y-3">
            {conversations.length === 0 ? (
              <p className="lux-empty">No conversations yet. Send a chat request from a member profile to start one.</p>
            ) : (
              conversations.map((conversation) => {
                const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;
                const lastMessage = conversation.messages[0];

                return (
                  <Link key={conversation.id} className="lux-card-soft block transition hover:border-[color:var(--lux-accent-border)]" href={`/chats/${conversation.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{otherUser.displayName}</p>
                          {otherUser.verificationStatus === VerificationStatus.APPROVED && otherUser.verifiedBadgeVisible ? (
                            <span className="lux-chip lux-chip-accent">Verified</span>
                          ) : null}
                        </div>
                        <RelativeTime className="mt-3 block text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]" value={(lastMessage ? lastMessage.createdAt : conversation.updatedAt).toISOString()} />
                      </div>
                      <span className="lux-button-subtle px-3 py-1.5 text-xs">Open chat</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">
                      {lastMessage ? lastMessage.body : "No messages yet. Open the conversation to say hello."}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="lux-card">
            <div className="border-b lux-divider pb-5">
              <p className="lux-overline">Incoming</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Requests to review</h2>
            </div>
            <div className="mt-5 space-y-3">
              {incomingRequests.length === 0 ? (
                <p className="lux-empty">No pending chat requests.</p>
              ) : (
                incomingRequests.map((request) => (
                  <div key={request.id} className="lux-card-soft text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link className="font-medium text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={`/users/${request.fromUser.id}`}>
                          {request.fromUser.displayName}
                        </Link>
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
                          <span className="mr-1">Requested</span>
                          <RelativeTime value={request.createdAt.toISOString()} />
                        </div>
                      </div>
                      <span className="lux-chip">{request.fromUser.verificationStatus}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className="lux-button-secondary" href={`/users/${request.fromUser.id}`}>
                        View profile
                      </Link>
                      <form action={reviewChatRequestAction}>
                        <input name="chatRequestId" type="hidden" value={request.id} />
                        <input name="decision" type="hidden" value="accept" />
                        <input name="redirectToConversation" type="hidden" value="true" />
                        <button className="lux-button-primary" type="submit">Accept and open chat</button>
                      </form>
                      <form action={reviewChatRequestAction}>
                        <input name="chatRequestId" type="hidden" value={request.id} />
                        <input name="decision" type="hidden" value="reject" />
                        <button className="lux-button-secondary" type="submit">Reject</button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lux-card">
            <div className="border-b lux-divider pb-5">
              <p className="lux-overline">Outgoing</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Requests already sent</h2>
            </div>
            <div className="mt-5 space-y-3">
              {outgoingRequests.length === 0 ? (
                <p className="lux-empty">No outgoing chat requests.</p>
              ) : (
                outgoingRequests.map((request) => (
                  <div key={request.id} className="lux-card-soft text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Link className="font-medium text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={`/users/${request.toUser.id}`}>
                        {request.toUser.displayName}
                      </Link>
                      <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
                        <span className="mr-1">Sent</span>
                        <RelativeTime value={request.createdAt.toISOString()} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className="lux-button-secondary" href={`/users/${request.toUser.id}`}>
                        Open profile
                      </Link>
                      <span className="lux-chip">Waiting for response</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { ConversationKind } from "@prisma/client";
import { LifeBuoy } from "lucide-react";
import { reviewChatRequestAction } from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { RelativeTime } from "@/components/relative-time";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { EmptyState, StatusBanner } from "@/components/ui/states";
import { ensureDefaultFeatureFlags, FEATURE_FLAG_KEYS, getFeatureAvailability } from "@/lib/feature-flags";

function Avatar({ initial }: { initial: string }) {
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[color:var(--ev-line-2)] bg-[image:var(--ev-avatar)] text-sm font-semibold text-[color:var(--ev-text)]">
      {initial}
    </div>
  );
}

export default async function ChatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;
  await ensureDefaultFeatureFlags();

  const [conversations, incomingRequests, outgoingRequests, features] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        status: "ACTIVE",
        kind: ConversationKind.MEMBER_CHAT,
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
            emailVerified: true,
            phoneVerifiedAt: true,
            verificationStatus: true,
            kycVerified: true,
            buddyProfile: { select: { domains: { select: { id: true }, take: 1 } } },
          },
        },
        userOne: {
          select: {
            id: true,
            displayName: true,
            emailVerified: true,
            phoneVerifiedAt: true,
            verificationStatus: true,
            kycVerified: true,
            buddyProfile: { select: { domains: { select: { id: true }, take: 1 } } },
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
            emailVerified: true,
            phoneVerifiedAt: true,
            verificationStatus: true,
            kycVerified: true,
            buddyProfile: { select: { domains: { select: { id: true }, take: 1 } } },
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
    getFeatureAvailability([FEATURE_FLAG_KEYS.buddy], viewer),
  ]);

  const buddyEnabled = features[FEATURE_FLAG_KEYS.buddy];

  const savedMessage = resolvedSearchParams?.saved === "incoming-chat"
    ? "You already have an incoming request from this member."
    : resolvedSearchParams?.saved === "chat-revoked"
      ? "Chat access was revoked."
      : resolvedSearchParams?.saved === "video-request"
        ? "Video request sent."
        : resolvedSearchParams?.saved === "user-blocked"
          ? "Member blocked. Existing chat access was closed immediately."
          : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pb-[calc(var(--member-shell-bottom-offset)+1rem)] pt-4" data-testid="chats-page">
      {savedMessage ? <StatusBanner className="mb-4">{savedMessage}</StatusBanner> : null}

      <header className="mb-5">
        <h1 className="ev-display text-[1.75rem] font-medium tracking-tight text-[color:var(--ev-text)]">Chats</h1>
        <p className="mt-1 text-sm text-[color:var(--ev-text-2)]">Private by design — conversations open only when both of you agree.</p>
      </header>

      {incomingRequests.length > 0 ? (
        <section className="mb-5" data-testid="chat-requests">
          <div className="mb-2 flex items-center justify-between">
            <p className="ev-label text-[color:var(--ev-gold-text)]">Requests</p>
            <span className="ev-badge ev-badge-connected">{incomingRequests.length}</span>
          </div>
          <div className="space-y-3">
            {incomingRequests.map((request) => (
              <div className="ev-card ev-rail-sage p-4" key={request.id}>
                <div className="flex items-center gap-3">
                  <Avatar initial={request.fromUser.displayName.slice(0, 1).toUpperCase()} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="font-medium text-[color:var(--ev-text)] underline-offset-4 hover:underline" href={`/users/${request.fromUser.id}`}>
                        {request.fromUser.displayName}
                      </Link>
                      <HomeTrustBadge
                        compact
                        emailVerified={Boolean(request.fromUser.emailVerified)}
                        isBuddyApproved={Boolean(request.fromUser.buddyProfile?.domains?.length)}
                        kycVerified={Boolean(request.fromUser.kycVerified)}
                        phoneVerified={Boolean(request.fromUser.phoneVerifiedAt)}
                        verificationStatus={request.fromUser.verificationStatus}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--ev-text-3)]">They can&rsquo;t message you until you accept.</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <form action={reviewChatRequestAction} className="flex-1">
                    <input name="chatRequestId" type="hidden" value={request.id} />
                    <input name="decision" type="hidden" value="accept" />
                    <input name="redirectToConversation" type="hidden" value="true" />
                    <button className="ev-btn-primary w-full py-2.5 text-sm" type="submit">Accept</button>
                  </form>
                  <form action={reviewChatRequestAction} className="flex-1">
                    <input name="chatRequestId" type="hidden" value={request.id} />
                    <input name="decision" type="hidden" value="reject" />
                    <button className="ev-btn-secondary w-full py-2.5 text-sm" type="submit">Decline</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {buddyEnabled ? (
        <Link className="ev-card ev-rail-gold mb-5 flex items-center gap-3 p-4" href="/buddy">
          <span className="ev-fab h-11 w-11 shadow-none">
            <LifeBuoy className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[color:var(--ev-text)]">Buddy support</p>
            <p className="text-xs text-[color:var(--ev-text-3)]">A steady, private hand when you need one.</p>
          </div>
        </Link>
      ) : null}

      <section data-testid="chat-list">
        <p className="ev-label mb-2 text-[color:var(--ev-gold-text)]">Conversations</p>
        {conversations.length === 0 ? (
          <EmptyState
            action={{ label: "Explore people", href: "/search" }}
            body="When a connection request is accepted, your conversation opens here."
            title="No conversations yet"
          />
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;
              const lastMessage = conversation.messages[0];

              return (
                <Link
                  className="ev-card flex items-center gap-3 p-3.5 transition hover:border-[color:var(--ev-line-2)]"
                  href={`/chats/${conversation.id}`}
                  key={conversation.id}
                >
                  <Avatar initial={otherUser.displayName.slice(0, 1).toUpperCase()} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-[color:var(--ev-text)]">{otherUser.displayName}</p>
                        <HomeTrustBadge
                          compact
                          emailVerified={Boolean(otherUser.emailVerified)}
                          isBuddyApproved={Boolean(otherUser.buddyProfile?.domains?.length)}
                          kycVerified={Boolean(otherUser.kycVerified)}
                          phoneVerified={Boolean(otherUser.phoneVerifiedAt)}
                          verificationStatus={otherUser.verificationStatus}
                        />
                      </div>
                      <RelativeTime
                        className="flex-none text-[11px] text-[color:var(--ev-text-3)]"
                        value={(lastMessage ? lastMessage.createdAt : conversation.updatedAt).toISOString()}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-[color:var(--ev-text-2)]">
                      {lastMessage ? lastMessage.body : "No messages yet — open to say hello."}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {outgoingRequests.length > 0 ? (
        <section className="mt-6">
          <p className="ev-label mb-2 text-[color:var(--ev-text-3)]">Sent · waiting</p>
          <div className="space-y-2">
            {outgoingRequests.map((request) => (
              <div className="ev-card flex items-center justify-between gap-3 p-3.5 text-sm" key={request.id}>
                <Link className="font-medium text-[color:var(--ev-text)] underline-offset-4 hover:underline" href={`/users/${request.toUser.id}`}>
                  {request.toUser.displayName}
                </Link>
                <span className="ev-chip text-[color:var(--ev-text-3)]">Waiting</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

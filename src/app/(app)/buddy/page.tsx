import Link from "next/link";
import { BuddyRequestAssignmentStatus, BuddyRequestStatus, ConversationKind, ConversationStatus, NotificationType } from "@prisma/client";
import {
  cancelBuddyRequestAction,
  extendBuddyRequestAction,
  reviewBuddyAssignmentAction,
} from "./actions";
import { submitBuddyRecommendationAction } from "./application-actions";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { refreshBuddyStateForUser } from "@/lib/buddy";
import { RelativeTime } from "@/components/relative-time";

const savedMessages: Record<string, string> = {
  buddy: "Buddy availability updated.",
  "request-submitted": "Your Buddy request was shared with available Buddies.",
  "request-already-open": "You already have an active Buddy request. Open it here instead of creating a new one.",
  "request-extended": "Your Buddy request was extended and shared again.",
  "request-cancelled": "Buddy request cancelled.",
  "request-declined": "Buddy request declined.",
  "request-unavailable": "That Buddy request is no longer available.",
  "buddy-recommendation-submitted": "Your Buddy recommendation was submitted.",
  assigned: "Buddy connection created.",
  "connection-ended": "Buddy connection ended.",
  "buddy-blocked": "Buddy access was blocked.",
};

function formatCooldownMessage(cooldownUntil?: string) {
  if (!cooldownUntil) {
    return "You can send another Buddy request 24 hours after your last cancellation.";
  }

  const date = new Date(cooldownUntil);
  if (Number.isNaN(date.getTime())) {
    return "You can send another Buddy request 24 hours after your last cancellation.";
  }

  return `You can send another Buddy request after ${date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`;
}

export default async function BuddyPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; cooldownUntil?: string }>;
}) {
  const viewer = await requireActiveUser();
  await refreshBuddyStateForUser(viewer.id);
  const resolvedSearchParams = await searchParams;

  await prisma.notification.updateMany({
    where: {
      userId: viewer.id,
      isRead: false,
      OR: [
        {
          type: {
            in: [
              NotificationType.BUDDY_REQUEST_SUBMITTED,
              NotificationType.BUDDY_REQUEST_INCOMING,
              NotificationType.BUDDY_REQUEST_ASSIGNED,
              NotificationType.BUDDY_REQUEST_DECISION_NEEDED,
              NotificationType.BUDDY_REQUEST_NO_MATCH,
              NotificationType.BUDDY_REQUEST_CANCELLED,
              NotificationType.BUDDY_REQUEST_NO_LONGER_RELEVANT,
              NotificationType.BUDDY_VIDEO_REQUEST_INCOMING,
              NotificationType.BUDDY_VIDEO_REQUEST_APPROVED,
            ],
          },
        },
        {
          type: NotificationType.CHAT_MESSAGE_RECEIVED,
          payloadJson: {
            path: ["conversationKind"],
            equals: ConversationKind.BUDDY_SUPPORT,
          },
        },
      ],
    },
    data: { isRead: true, readAt: new Date() },
  });

  const [buddyProfile, seekerRequests, assignmentCards, conversations, recommendationRequests] = await Promise.all([
    prisma.buddyProfile.findUnique({
      where: { userId: viewer.id },
      select: {
        isAvailable: true,
        intro: true,
        availabilityLevel: true,
        domains: { select: { domain: { select: { id: true, name: true } } } },
      },
    }),
    prisma.buddyRequest.findMany({
      where: { seekerId: viewer.id, status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        domain: { select: { id: true, name: true } },
        message: true,
        status: true,
        createdAt: true,
        assignedBuddy: { select: { id: true, displayName: true } },
        conversation: { select: { id: true } },
        assignments: { select: { id: true } },
      },
    }),
    prisma.buddyRequestAssignment.findMany({
      where: {
        buddyId: viewer.id,
        status: { in: [BuddyRequestAssignmentStatus.PENDING, BuddyRequestAssignmentStatus.NOT_RELEVANT] },
        buddyRequest: { status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.ASSIGNED, BuddyRequestStatus.AWAITING_SEEKER_DECISION] } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        buddyRequest: {
          select: {
            id: true,
            domain: { select: { id: true, name: true } },
            message: true,
            seeker: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.conversation.findMany({
      where: {
        kind: ConversationKind.BUDDY_SUPPORT,
        status: ConversationStatus.ACTIVE,
        OR: [{ userOneId: viewer.id }, { userTwoId: viewer.id }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        updatedAt: true,
        userOneId: true,
        userOne: { select: { id: true, displayName: true } },
        userTwo: { select: { id: true, displayName: true } },
        buddyRequest: { select: { domain: { select: { id: true, name: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
      },
    }),
    prisma.buddyApplicationRecommendation.findMany({
      where: { recommenderUserId: viewer.id, status: "PENDING", replacedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        applicationDomain: {
          select: {
            id: true,
            domain: { select: { name: true } },
            application: { select: { applicant: { select: { displayName: true } } } },
          },
        },
      },
    }),
  ]);

  const savedMessage = resolvedSearchParams?.saved === "request-cooldown"
    ? formatCooldownMessage(resolvedSearchParams.cooldownUntil)
    : resolvedSearchParams?.saved
      ? savedMessages[resolvedSearchParams.saved]
      : null;

  const needHelpHref = seekerRequests.length > 0 ? "/buddy" : "/buddy/new";

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
            <p className="lux-overline">Buddy</p>
            <h1 className="lux-title mt-3">Peer support when someone needs a steadier hand.</h1>
            <p className="lux-body mt-4">Buddy is member-to-member support and mentorship. It is not therapy, medical care, or legal advice.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link className="lux-button-primary" href={needHelpHref}>Need help? Get a Buddy</Link>
            <Link className="lux-button-secondary" href="/settings#buddy-setup">Manage Buddy profile</Link>
          </div>
        </div>
      </section>

      {recommendationRequests.length > 0 ? (
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Buddy recommendations</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Members asking for your recommendation</h2>
          </div>
          <div className="mt-5 space-y-3">
            {recommendationRequests.map((recommendation) => (
              <div className="lux-card-soft" key={recommendation.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{recommendation.applicationDomain.application.applicant.displayName}</p>
                      <span className="lux-chip">{recommendation.applicationDomain.domain.name}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Recommendation notes are visible to admin only and cannot be edited after submission.</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">Requested <RelativeTime value={recommendation.createdAt.toISOString()} /></p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <form action={submitBuddyRecommendationAction} className="grid gap-3">
                    <input name="recommendationId" type="hidden" value={recommendation.id} />
                    <input name="decision" type="hidden" value="approve" />
                    <label className="grid gap-2 text-sm text-[color:var(--lux-text-secondary)]">
                      <span className="font-medium text-[color:var(--lux-text)]">Admin-only note</span>
                      <textarea className="lux-textarea min-h-[96px]" maxLength={500} name="note" placeholder="Optional private note for admin review." />
                    </label>
                    <button className="lux-button-primary" type="submit">Approve recommendation</button>
                  </form>
                  <form action={submitBuddyRecommendationAction} className="grid gap-3">
                    <input name="recommendationId" type="hidden" value={recommendation.id} />
                    <input name="decision" type="hidden" value="decline" />
                    <label className="grid gap-2 text-sm text-[color:var(--lux-text-secondary)]">
                      <span className="font-medium text-[color:var(--lux-text)]">Admin-only note</span>
                      <textarea className="lux-textarea min-h-[96px]" maxLength={500} name="note" placeholder="Optional private note for admin review." />
                    </label>
                    <button className="lux-button-secondary" type="submit">Decline recommendation</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Your Buddy profile</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Availability and support domains</h2>
          </div>
          <div className="mt-5 space-y-4 text-sm text-[color:var(--lux-text-secondary)]">
            <div className="lux-card-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{buddyProfile?.isAvailable ? "Available as a Buddy" : "Not currently available as a Buddy"}</p>
                  <p className="mt-2 leading-6">{buddyProfile?.intro ?? "You can opt in from Settings and choose the domains where you feel comfortable supporting others."}</p>
                </div>
                {buddyProfile?.availabilityLevel ? <span className="lux-chip">{buddyProfile.availabilityLevel}</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {buddyProfile?.domains.length ? buddyProfile.domains.map((domain) => (
                  <span className="lux-chip lux-chip-accent" key={domain.domain.name}>{domain.domain.name}</span>
                )) : <span className="text-sm text-[color:var(--lux-text-muted)]">No Buddy domains selected yet.</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Open support requests</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Requests you started</h2>
          </div>
          <div className="mt-5 space-y-3">
            {seekerRequests.length === 0 ? <p className="lux-empty">No open Buddy requests right now.</p> : seekerRequests.map((request) => (
              <div className="lux-card-soft" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{request.domain.name}</p>
                      <span className="lux-chip">{request.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{request.message ?? "No extra message was added."}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
                      <span>Submitted <RelativeTime value={request.createdAt.toISOString()} /></span>
                      <span>{request.assignments.length} Buddy copies</span>
                    </div>
                  </div>
                  {request.assignedBuddy && request.conversation ? <Link className="lux-button-secondary" href={`/buddy/${request.conversation.id}`}>Open Buddy chat</Link> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {request.status === BuddyRequestStatus.AWAITING_SEEKER_DECISION ? (
                    <form action={extendBuddyRequestAction}>
                      <input name="buddyRequestId" type="hidden" value={request.id} />
                      <button className="lux-button-primary" type="submit">Extend request</button>
                    </form>
                  ) : null}
                  {request.status !== BuddyRequestStatus.ASSIGNED ? (
                    <form action={cancelBuddyRequestAction}>
                      <input name="buddyRequestId" type="hidden" value={request.id} />
                      <button className="lux-button-secondary" type="submit">Cancel request</button>
                    </form>
                  ) : null}
                  {request.status === BuddyRequestStatus.AWAITING_SEEKER_DECISION ? <span className="text-sm text-[color:var(--lux-text-muted)]">No Buddy accepted yet. You can extend or cancel.</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Incoming Buddy requests</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Requests matching your domains</h2>
          </div>
          <div className="mt-5 space-y-3">
            {assignmentCards.length === 0 ? <p className="lux-empty">No incoming Buddy requests right now.</p> : assignmentCards.map((assignment) => {
              const isRelevant = assignment.status === BuddyRequestAssignmentStatus.PENDING;
              return (
                <div className={isRelevant ? "lux-card-soft" : "rounded-[1.35rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] p-5 opacity-70"} key={assignment.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{assignment.buddyRequest.seeker.displayName}</p>
                        <span className="lux-chip">{assignment.buddyRequest.domain.name}</span>
                        {!isRelevant ? <span className="lux-chip">No longer relevant</span> : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{assignment.buddyRequest.message ?? "No extra message was provided."}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
                        <span>Received <RelativeTime value={assignment.createdAt.toISOString()} /></span>
                      </div>
                    </div>
                  </div>
                  {isRelevant ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={reviewBuddyAssignmentAction}>
                        <input name="assignmentId" type="hidden" value={assignment.id} />
                        <input name="decision" type="hidden" value="accept" />
                        <button className="lux-button-primary" type="submit">Accept as Buddy</button>
                      </form>
                      <form action={reviewBuddyAssignmentAction}>
                        <input name="assignmentId" type="hidden" value={assignment.id} />
                        <input name="decision" type="hidden" value="decline" />
                        <button className="lux-button-secondary" type="submit">Decline</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Buddy conversations</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Active support spaces</h2>
          </div>
          <div className="mt-5 space-y-3">
            {conversations.length === 0 ? <p className="lux-empty">No active Buddy conversations yet.</p> : conversations.map((conversation) => {
              const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;
              const latestMessage = conversation.messages[0];
              return (
                <Link className="lux-card-soft block transition hover:border-[color:var(--lux-accent-border)]" href={`/buddy/${conversation.id}`} key={conversation.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{otherUser.displayName}</p>
                        <span className="lux-chip lux-chip-accent">Buddy</span>
                        <span className="lux-chip">{conversation.buddyRequest?.domain.name ?? "Buddy"}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{latestMessage?.body ?? "Open your Buddy conversation to continue the exchange."}</p>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
                      <RelativeTime className="block" value={(latestMessage?.createdAt ?? conversation.updatedAt).toISOString()} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

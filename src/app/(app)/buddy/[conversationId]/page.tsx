import Link from "next/link";
import { ConsentStatus, ConversationKind, NotificationType, VerificationStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { isJoinableCallRecord } from "@/lib/livekit";
import { blockUserAction, reportUserAction } from "../../actions";
import {
  endBuddyConversationAction,
  requestBuddyVideoConsentAction,
  reviewBuddyVideoConsentAction,
  revokeBuddyVideoConsentAction,
} from "../actions";
import { ConversationThread } from "../../chats/[conversationId]/conversation-thread";
import { StartBuddyVideoCallButton } from "../start-buddy-video-call-button";
import { FeatureUnavailableCard } from "@/components/feature-unavailable-card";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getHighRiskAccessState, HIGH_RISK_ACTIONS } from "@/lib/high-risk-access";

const savedMessages: Record<string, string> = {
  assigned: "Buddy connection created.",
  "video-request": "Buddy video request sent.",
  "video-approved": "Buddy video approved.",
  "video-declined": "Buddy video declined.",
  "video-revoked": "Buddy video revoked.",
};

export default async function BuddyConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireActiveUser();
  const featureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.buddy, viewer);

  if (!featureEnabled) {
    return (
      <FeatureUnavailableCard
        eyebrow="Buddy"
        title="Buddy is currently unavailable"
        description="Buddy support is turned off right now. Your regular chats and settings are still available."
        href="/home"
      />
    );
  }
  const { conversationId } = await params;
  const resolvedSearchParams = await searchParams;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      kind: true,
      status: true,
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
      buddyRequest: {
        select: {
          id: true,
          domain: { select: { name: true } },
          message: true,
        },
      },
      buddyVideoConsent: {
        select: {
          id: true,
          status: true,
          requesterUserId: true,
          targetUserId: true,
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
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          body: true,
          createdAt: true,
          deletedAt: true,
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
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!conversation || conversation.kind !== ConversationKind.BUDDY_SUPPORT) {
    notFound();
  }

  const isParticipant = conversation.userOneId === viewer.id || conversation.userTwoId === viewer.id;
  if (!isParticipant || conversation.status !== "ACTIVE") {
    notFound();
  }

  const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;
  await prisma.notification.updateMany({
    where: {
      userId: viewer.id,
      isRead: false,
      OR: [
        {
          type: {
            in: [
              NotificationType.BUDDY_REQUEST_ASSIGNED,
              NotificationType.BUDDY_VIDEO_REQUEST_INCOMING,
              NotificationType.BUDDY_VIDEO_REQUEST_APPROVED,
            ],
          },
        },
        {
          type: NotificationType.CHAT_MESSAGE_RECEIVED,
          payloadJson: {
            path: ["conversationId"],
            equals: conversation.id,
          },
        },
      ],
    },
    data: { isRead: true, readAt: new Date() },
  });

  const [notificationSettings] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId: viewer.id },
      select: { webPushEnabled: true, pushPromptDismissedAt: true },
    }),
  ]);
  const videoTrustAccess = await getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.VIDEO_REQUEST);

  const activeCallRecord = conversation.videoCallRecords[0] ?? null;
  const callMode = isJoinableCallRecord(activeCallRecord) ? "join" : "start";
  const videoConsent = conversation.buddyVideoConsent;
  const savedMessage = resolvedSearchParams?.saved ? savedMessages[resolvedSearchParams.saved] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {savedMessage ? <div className="rounded-[1rem] border border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[color:var(--lux-text-secondary)]">{savedMessage}</div> : null}
      <section className="lux-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="lux-overline">Buddy support conversation</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="lux-title !text-[2.3rem] md:!text-[2.8rem]">{otherUser.displayName}</h1>
              {otherUser.verificationStatus === VerificationStatus.APPROVED && otherUser.verifiedBadgeVisible ? (
                <span className="lux-chip lux-chip-accent">Verified</span>
              ) : null}
              <span className="lux-chip">{conversation.buddyRequest?.domain.name ?? "Buddy"}</span>
            </div>
            <p className="lux-body mt-4">A private support space, separate from member flirting and social chat.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {videoConsent?.status === ConsentStatus.APPROVED && videoTrustAccess.allowed ? <StartBuddyVideoCallButton conversationId={conversation.id} mode={callMode} /> : null}
            <Link className="lux-button-secondary" href="/buddy">Back to Buddy</Link>
            <Link className="lux-button-subtle" href={`/users/${otherUser.id}`}>View profile</Link>
          </div>
        </div>
        <div className="mt-5 rounded-[1rem] border border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)] p-4 text-sm text-[color:var(--lux-text-secondary)]">
          <p className="font-medium text-[color:var(--lux-text)]">
            {videoTrustAccess.allowed
              ? "Video calls require separate approval and can be revoked at any time."
              : `${videoTrustAccess.reason} ${videoTrustAccess.nextStep ?? ""}`.trim()}
          </p>
          {conversation.buddyRequest?.message ? <p className="mt-2 leading-6">Original request: {conversation.buddyRequest.message}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!videoConsent && videoTrustAccess.allowed ? (
              <form action={requestBuddyVideoConsentAction}>
                <input name="conversationId" type="hidden" value={conversation.id} />
                <button className="lux-button-secondary" type="submit">Request Buddy video approval</button>
              </form>
            ) : null}
            {videoConsent?.status === ConsentStatus.PENDING && videoConsent.targetUserId === viewer.id ? (
              <>
                <form action={reviewBuddyVideoConsentAction}>
                  <input name="consentId" type="hidden" value={videoConsent.id} />
                  <input name="decision" type="hidden" value="approve" />
                  <button className="lux-button-primary" type="submit">Approve video</button>
                </form>
                <form action={reviewBuddyVideoConsentAction}>
                  <input name="consentId" type="hidden" value={videoConsent.id} />
                  <input name="decision" type="hidden" value="decline" />
                  <button className="lux-button-secondary" type="submit">Decline</button>
                </form>
              </>
            ) : null}
            {videoConsent?.status === ConsentStatus.PENDING && videoConsent.requesterUserId === viewer.id ? <span className="lux-chip">Buddy video pending</span> : null}
            {videoConsent?.status === ConsentStatus.APPROVED ? (
              <>
                <span className="lux-chip lux-chip-accent">Video approved</span>
                <form action={revokeBuddyVideoConsentAction}>
                  <input name="conversationId" type="hidden" value={conversation.id} />
                  <button className="lux-button-subtle" type="submit">Revoke video</button>
                </form>
              </>
            ) : null}
            {videoTrustAccess.allowed && videoConsent && (videoConsent.status === ConsentStatus.DECLINED || videoConsent.status === ConsentStatus.REVOKED || videoConsent.status === ConsentStatus.CANCELED) ? (
              <form action={requestBuddyVideoConsentAction}>
                <input name="conversationId" type="hidden" value={conversation.id} />
                <button className="lux-button-secondary" type="submit">Request video again</button>
              </form>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={endBuddyConversationAction}>
              <input name="conversationId" type="hidden" value={conversation.id} />
              <button className="lux-button-subtle" type="submit">End Buddy connection</button>
            </form>
            <form action={reportUserAction}>
              <input name="targetUserId" type="hidden" value={otherUser.id} />
              <input name="sourcePath" type="hidden" value={`/buddy/${conversation.id}`} />
              <button className="lux-button-subtle" type="submit">Report user</button>
            </form>
            <form action={blockUserAction}>
              <input name="blockedUserId" type="hidden" value={otherUser.id} />
              <input name="sourcePath" type="hidden" value={`/buddy/${conversation.id}`} />
              <input name="reason" type="hidden" value="Blocked from Buddy conversation" />
              <button className="lux-button-subtle" type="submit">Block user</button>
            </form>
          </div>
        </div>
      </section>

      <ConversationThread
        conversationId={conversation.id}
        initialMessages={conversation.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
          deletedAt: message.deletedAt?.toISOString() ?? null,
          attachments: message.attachments.map((attachment) => ({
            ...attachment,
            deletedAt: attachment.deletedAt?.toISOString() ?? null,
          })),
          status: "sent" as const,
        }))}
        otherUserName={otherUser.displayName}
        viewerId={viewer.id}
        enablePushPrompt={!(notificationSettings?.webPushEnabled ?? false) && !notificationSettings?.pushPromptDismissedAt}
        pushPromptVariant="buddy"
      />
    </main>
  );
}



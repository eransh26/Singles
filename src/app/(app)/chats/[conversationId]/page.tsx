import Link from "next/link";
import { ConsentStatus, ConversationKind } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { isJoinableCallRecord } from "@/lib/livekit";
import { requestVideoConsentAction, revokeChatConsentAction, revokeVideoConsentAction, reviewVideoConsentAction } from "../../actions";
import { StartVideoCallButton } from "./start-video-call-button";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { ConversationThread } from "./conversation-thread";
import { getHighRiskAccessState, HIGH_RISK_ACTIONS } from "@/lib/high-risk-access";

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams?: Promise<{ saved?: string }> }) {
  const viewer = await requireUser();
  const { conversationId } = await params;
  const viewerEmailVerified = Boolean(viewer.emailVerified);
  const resolvedSearchParams = await searchParams;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      pairKey: true,
      kind: true,
      userOneId: true,
      userTwoId: true,
      status: true,
      userOne: {
        select: {
          id: true,
          displayName: true,
          emailVerified: true,
          phoneVerified: true,
          phoneVerifiedAt: true,
          kycVerified: true,
          ageVerified: true,
          verificationStatus: true,
          buddyProfile: {
            select: {
              isAvailable: true,
            },
          },
        },
      },
      userTwo: {
        select: {
          id: true,
          displayName: true,
          emailVerified: true,
          phoneVerified: true,
          phoneVerifiedAt: true,
          kycVerified: true,
          ageVerified: true,
          verificationStatus: true,
          buddyProfile: {
            select: {
              isAvailable: true,
            },
          },
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

  if (!conversation || conversation.kind !== ConversationKind.MEMBER_CHAT) {
    notFound();
  }

  const isParticipant = conversation.userOneId === viewer.id || conversation.userTwoId === viewer.id;
  if (!isParticipant || conversation.status !== "ACTIVE") {
    notFound();
  }

  const otherUser = conversation.userOne.id === viewer.id ? conversation.userTwo : conversation.userOne;
  const videoTrustAccess = await getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.VIDEO_REQUEST);
  const activeCallRecord = conversation.videoCallRecords[0] ?? null;
  const callMode = isJoinableCallRecord(activeCallRecord) ? "join" : "start";
  const [videoConsent, notificationSettings] = await Promise.all([
    prisma.videoConsent.findUnique({
    where: { pairKey: conversation.pairKey },
    select: {
      id: true,
      status: true,
      requesterUserId: true,
      targetUserId: true,
    },
    }),
    prisma.userSettings.findUnique({
      where: { userId: viewer.id },
      select: { webPushEnabled: true, pushPromptDismissedAt: true },
    }),
  ]);

  const saveMessage = resolvedSearchParams?.saved === "video-request" ? "Video request sent." : resolvedSearchParams?.saved === "chat-revoked" ? "Chat access was revoked." : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {saveMessage ? <div className="rounded-[1rem] border border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[color:var(--lux-text-secondary)]">{saveMessage}</div> : null}
      <section className="lux-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="lux-overline">Conversation</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="lux-title !text-[2.3rem] md:!text-[2.8rem]">{otherUser.displayName}</h1>
              <HomeTrustBadge
                compact={false}
                emailVerified={Boolean(otherUser.emailVerified)}
                phoneVerified={Boolean(otherUser.phoneVerified)}
                phoneVerifiedAt={otherUser.phoneVerifiedAt}
                kycVerified={Boolean(otherUser.kycVerified)}
                ageVerified={Boolean(otherUser.ageVerified)}
                verificationStatus={otherUser.verificationStatus}
                isBuddyApproved={Boolean(otherUser.buddyProfile?.isAvailable)}
              />
            </div>
            <p className="lux-body mt-4">A private thread for a slower, more direct exchange.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {videoConsent?.status === ConsentStatus.APPROVED && videoTrustAccess.allowed ? <StartVideoCallButton conversationId={conversation.id} mode={callMode} /> : null}
            <Link className="lux-button-secondary" href="/chats">Back to chats</Link>
            <Link className="lux-button-subtle" href={`/users/${otherUser.id}`}>View profile</Link>
          </div>
        </div>
        <div className="mt-5 rounded-[1rem] border border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)] p-4 text-sm text-[color:var(--lux-text-secondary)]">
          <p className="font-medium text-[color:var(--lux-text)]">{!viewerEmailVerified ? "Verify your email before requesting video approval or sending messages." : videoTrustAccess.allowed ? "Video calls require separate approval and can be revoked at any time." : `${videoTrustAccess.reason} ${videoTrustAccess.nextStep ?? ""}`.trim()}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!videoConsent && viewerEmailVerified && videoTrustAccess.allowed ? (
              <form action={requestVideoConsentAction}>
                <input name="targetUserId" type="hidden" value={otherUser.id} />
                <input name="sourcePath" type="hidden" value={`/chats/${conversation.id}`} />
                <button className="lux-button-secondary" type="submit">Request video approval</button>
              </form>
            ) : null}
            {videoConsent?.status === ConsentStatus.PENDING && videoConsent.targetUserId === viewer.id ? (
              <>
                <form action={reviewVideoConsentAction}>
                  <input name="consentId" type="hidden" value={videoConsent.id} />
                  <input name="decision" type="hidden" value="approve" />
                  <button className="lux-button-primary" type="submit">Approve video</button>
                </form>
                <form action={reviewVideoConsentAction}>
                  <input name="consentId" type="hidden" value={videoConsent.id} />
                  <input name="decision" type="hidden" value="decline" />
                  <button className="lux-button-secondary" type="submit">Decline</button>
                </form>
              </>
            ) : null}
            {videoConsent?.status === ConsentStatus.PENDING && videoConsent.requesterUserId === viewer.id ? <span className="lux-chip">Video request pending</span> : null}
            {videoConsent?.status === ConsentStatus.APPROVED ? (
              <>
                <span className="lux-chip lux-chip-accent">Video approved</span>
                <form action={revokeVideoConsentAction}>
                  <input name="pairKey" type="hidden" value={conversation.pairKey} />
                  <input name="conversationId" type="hidden" value={conversation.id} />
                  <button className="lux-button-subtle" type="submit">Revoke video</button>
                </form>
              </>
            ) : null}
            {viewerEmailVerified && videoTrustAccess.allowed && videoConsent && (videoConsent.status === ConsentStatus.DECLINED || videoConsent.status === ConsentStatus.REVOKED || videoConsent.status === ConsentStatus.CANCELED) ? (
              <form action={requestVideoConsentAction}>
                <input name="targetUserId" type="hidden" value={otherUser.id} />
                <input name="sourcePath" type="hidden" value={`/chats/${conversation.id}`} />
                <button className="lux-button-secondary" type="submit">Request video approval again</button>
              </form>
            ) : null}
            <form action={revokeChatConsentAction}>
              <input name="conversationId" type="hidden" value={conversation.id} />
              <button className="lux-button-subtle" type="submit">Revoke chat</button>
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
        pushPromptVariant="messages"
        composerDisabledReason={!viewerEmailVerified ? "Verify your email before sending messages." : null}
      />
    </main>
  );
}






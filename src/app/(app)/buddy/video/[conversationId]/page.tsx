import Link from "next/link";
import { ConsentStatus, ConversationKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getVideoConversationById, isAuthorizedVideoParticipant } from "@/lib/livekit";
import { BuddyVideoRoomClient } from "./video-room-client";
import { FeatureUnavailableCard } from "@/components/feature-unavailable-card";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getHighRiskAccessState, HIGH_RISK_ACTIONS } from "@/lib/high-risk-access";

export default async function BuddyVideoConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const user = await requireActiveUser();
  const featureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.buddy, user);

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
  const conversation = await getVideoConversationById(conversationId);

  if (!conversation || conversation.kind !== ConversationKind.BUDDY_SUPPORT || !isAuthorizedVideoParticipant(conversation, user.id)) {
    notFound();
  }

  const videoConsent = await prisma.buddyVideoConsent.findUnique({
    where: { conversationId: conversation.id },
    select: { status: true },
  });

  if (!videoConsent || videoConsent.status !== ConsentStatus.APPROVED) {
    notFound();
  }

  const otherUser = conversation.userOne.id === user.id ? conversation.userTwo : conversation.userOne;
  const videoTrustAccess = await getHighRiskAccessState(prisma, user.id, HIGH_RISK_ACTIONS.VIDEO_REQUEST);

  if (!videoTrustAccess.allowed) {
    return (
      <main className="lux-shell">
        <section className="lux-hero">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="lux-overline">Buddy video</p>
              <h1 className="lux-title mt-3 !text-[2.3rem] md:!text-[2.8rem]">{otherUser.displayName}</h1>
              <p className="lux-body mt-4">{`${videoTrustAccess.reason} ${videoTrustAccess.nextStep ?? ""}`.trim()}</p>
            </div>
            <Link className="lux-button-secondary" href={`/buddy/${conversation.id}`}>Back to Buddy chat</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="lux-shell">
      <section className="lux-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="lux-overline">Buddy video</p>
            <h1 className="lux-title mt-3 !text-[2.3rem] md:!text-[2.8rem]">{otherUser.displayName}</h1>
            <p className="lux-body mt-4">A secure 1:1 room tied to your approved Buddy support conversation.</p>
          </div>
          <Link className="lux-button-secondary" href={`/buddy/${conversation.id}`}>Back to Buddy chat</Link>
        </div>
      </section>

      <BuddyVideoRoomClient conversationId={conversation.id} otherUserName={otherUser.displayName} />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/guards";
import { getVideoConversationById, isAuthorizedVideoParticipant } from "@/lib/livekit";
import { VideoRoomClient } from "./video-room-client";

export default async function VideoConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const user = await requireActiveUser();
  const { conversationId } = await params;
  const conversation = await getVideoConversationById(conversationId);

  if (!conversation || !isAuthorizedVideoParticipant(conversation, user.id)) {
    notFound();
  }

  const otherUser = conversation.userOne.id === user.id ? conversation.userTwo : conversation.userOne;

  return (
    <main className="lux-shell">
      <section className="lux-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="lux-overline">Private video</p>
            <h1 className="lux-title mt-3 !text-[2.3rem] md:!text-[2.8rem]">{otherUser.displayName}</h1>
            <p className="lux-body mt-4">A secure 1:1 room tied to your approved private conversation.</p>
          </div>
          <Link className="lux-button-secondary" href={`/chats/${conversation.id}`}>Back to chat</Link>
        </div>
      </section>

      <VideoRoomClient conversationId={conversation.id} otherUserName={otherUser.displayName} />
    </main>
  );
}

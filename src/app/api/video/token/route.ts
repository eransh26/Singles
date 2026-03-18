import { NextResponse } from "next/server";
import { AccountStatus, UserRole } from "@prisma/client";
import { AccessToken } from "livekit-server-sdk";
import { getCurrentUser } from "@/lib/auth/guards";
import { createOrJoinVideoCallRecord, getVideoConversationById, isAuthorizedVideoParticipant } from "@/lib/livekit";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.accountStatus !== AccountStatus.ACTIVE || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    return NextResponse.json({ error: "Not authorized for this video call." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
  }

  const conversation = await getVideoConversationById(conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (!isAuthorizedVideoParticipant(conversation, user.id)) {
    return NextResponse.json({ error: "Not authorized for this video call." }, { status: 403 });
  }

  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "LiveKit is not configured." }, { status: 503 });
  }

  try {
    const callRecord = await createOrJoinVideoCallRecord(conversation.id, user.id);
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: user.id,
      name: user.displayName,
      ttl: "10m",
    });

    token.addGrant({
      room: callRecord.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json(
      {
        token: await token.toJwt(),
        roomName: callRecord.roomName,
        callRecordId: callRecord.callRecordId,
        callMode: callRecord.callMode,
        livekitUrl: process.env.LIVEKIT_URL,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "The private room could not be prepared right now." }, { status: 500 });
  }
}

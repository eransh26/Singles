import { NextResponse } from "next/server";
import { AccountStatus, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/guards";
import { getVideoConversationById, isAuthorizedVideoParticipant, markVideoCallLeft } from "@/lib/livekit";

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
  const callRecordId = typeof body?.callRecordId === "string" ? body.callRecordId : "";

  if (!conversationId || !callRecordId) {
    return NextResponse.json({ error: "conversationId and callRecordId are required." }, { status: 400 });
  }

  const conversation = await getVideoConversationById(conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (!isAuthorizedVideoParticipant(conversation, user.id)) {
    return NextResponse.json({ error: "Not authorized for this video call." }, { status: 403 });
  }

  try {
    await markVideoCallLeft(callRecordId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "The room could not be closed cleanly." }, { status: 500 });
  }
}

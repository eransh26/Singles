import { NextResponse } from "next/server";
import { AccountStatus, ConversationKind, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/guards";
import { markVideoCallLeft } from "@/lib/livekit";
import { prisma } from "@/lib/db/prisma";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.buddy, user))) {
    return NextResponse.json({ error: "Feature unavailable." }, { status: 404 });
  }

  if (user.accountStatus !== AccountStatus.ACTIVE || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    return NextResponse.json({ error: "Not authorized for this Buddy video call." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const callRecordId = typeof body?.callRecordId === "string" ? body.callRecordId : "";

  if (!conversationId || !callRecordId) {
    return NextResponse.json({ error: "conversationId and callRecordId are required." }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      kind: true,
      userOneId: true,
      userTwoId: true,
    },
  });

  if (!conversation || conversation.kind !== ConversationKind.BUDDY_SUPPORT) {
    return NextResponse.json({ error: "Buddy conversation not found." }, { status: 404 });
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Not authorized for this Buddy video call." }, { status: 403 });
  }

  await markVideoCallLeft(callRecordId);
  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextResponse } from "next/server";
import { AccountStatus, ReportStatus, ReportTargetType, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

const ALLOWED_REPORT_REASONS = new Set([
  "HARASSMENT",
  "NON_CONSENSUAL_CONTENT",
  "SPAM",
  "ILLEGAL_CONTENT",
  "OTHER",
]);

async function requireApiMember() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) } as const;
  }

  if (user.accountStatus !== AccountStatus.ACTIVE || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    return { error: NextResponse.json({ error: "Not authorized for this conversation." }, { status: 403 }) } as const;
  }

  return { user } as const;
}

async function getAuthorizedConversation(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      status: "ACTIVE",
      OR: [{ userOneId: userId }, { userTwoId: userId }],
    },
    select: { id: true },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiMember();
  if ("error" in auth) {
    return auth.error;
  }

  const { conversationId } = await params;
  const conversation = await getAuthorizedConversation(conversationId, auth.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const action = typeof payload?.action === "string" ? payload.action : "";
  const targetType = typeof payload?.targetType === "string" ? payload.targetType : "";
  const targetId = typeof payload?.targetId === "string" ? payload.targetId : "";
  const reasonCode = typeof payload?.reasonCode === "string" ? payload.reasonCode : "OTHER";
  const details = typeof payload?.details === "string" ? payload.details.trim() : null;

  if (!action || !targetType || !targetId) {
    return NextResponse.json({ error: "A valid moderation target is required." }, { status: 400 });
  }

  if (action === "report") {
    if (!ALLOWED_REPORT_REASONS.has(reasonCode)) {
      return NextResponse.json({ error: "Choose a valid report reason." }, { status: 400 });
    }

    if (targetType === "MESSAGE") {
      const message = await prisma.message.findFirst({
        where: { id: targetId, conversationId },
        select: { id: true },
      });

      if (!message) {
        return NextResponse.json({ error: "Message not found." }, { status: 404 });
      }

      await prisma.report.create({
        data: {
          filedByUserId: auth.user.id,
          targetType: ReportTargetType.MESSAGE,
          targetMessageId: message.id,
          reasonCode,
          details,
          status: ReportStatus.OPEN,
        },
      });
    } else if (targetType === "MESSAGE_ATTACHMENT") {
      const attachment = await prisma.messageAttachment.findFirst({
        where: { id: targetId, message: { conversationId } },
        select: { id: true },
      });

      if (!attachment) {
        return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      }

      await prisma.report.create({
        data: {
          filedByUserId: auth.user.id,
          targetType: ReportTargetType.MESSAGE_ATTACHMENT,
          targetMessageAttachmentId: attachment.id,
          reasonCode,
          details,
          status: ReportStatus.OPEN,
        },
      });
    } else {
      return NextResponse.json({ error: "Reporting is not available for that target." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Report submitted." }, { status: 201 });
  }

  if (action === "delete") {
    if (targetType === "MESSAGE") {
      const message = await prisma.message.findFirst({
        where: { id: targetId, conversationId, senderUserId: auth.user.id },
        select: { id: true },
      });

      if (!message) {
        return NextResponse.json({ error: "That message cannot be removed." }, { status: 403 });
      }

      await prisma.message.update({
        where: { id: message.id },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, message: "Message removed." }, { status: 200 });
    }

    if (targetType === "MESSAGE_ATTACHMENT") {
      const attachment = await prisma.messageAttachment.findFirst({
        where: { id: targetId, message: { conversationId, senderUserId: auth.user.id } },
        select: { id: true },
      });

      if (!attachment) {
        return NextResponse.json({ error: "That attachment cannot be removed." }, { status: 403 });
      }

      await prisma.messageAttachment.update({
        where: { id: attachment.id },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, message: "Attachment removed." }, { status: 200 });
    }

    return NextResponse.json({ error: "Deletion is not available for that target." }, { status: 400 });
  }

  return NextResponse.json({ error: "Unsupported moderation action." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { AccountStatus, ConversationStatus, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  getChatAttachmentValidationMessage,
  MAX_CHAT_ATTACHMENTS,
  MAX_CHAT_MESSAGE_LENGTH,
  validateChatAttachmentInput,
} from "@/lib/chat-attachments";

const RECENT_DUPLICATE_WINDOW_MS = 8_000;

type AttachmentPayload = {
  kind: "IMAGE" | "FILE";
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
};

async function getAuthorizedConversation(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      status: ConversationStatus.ACTIVE,
      OR: [{ userOneId: userId }, { userTwoId: userId }],
    },
    select: {
      id: true,
      userOneId: true,
      userTwoId: true,
    },
  });
}

function normalizeAttachments(value: unknown):
  | { ok: true; attachments: AttachmentPayload[] }
  | { ok: false; issue: "invalid" | "missing_data" | "too_large" | "too_many" | "unsupported_type"; fileName?: string } {
  if (value == null) {
    return { ok: true, attachments: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, issue: "invalid" };
  }

  if (value.length > MAX_CHAT_ATTACHMENTS) {
    return { ok: false, issue: "too_many" };
  }

  const attachments: AttachmentPayload[] = [];
  for (const item of value) {
    const result = validateChatAttachmentInput(item);
    if (!result.ok) {
      return result;
    }
    attachments.push(result.attachment);
  }

  return { ok: true, attachments };
}

function attachmentErrorResponse(issue: { issue: "invalid" | "missing_data" | "too_large" | "too_many" | "unsupported_type"; fileName?: string }) {
  const status = issue.issue === "too_large" ? 413 : issue.issue === "unsupported_type" ? 415 : 400;
  return NextResponse.json({ error: getChatAttachmentValidationMessage(issue.issue, issue.fileName) }, { status });
}

function buildDuplicateAttachmentSignature(attachments: AttachmentPayload[]) {
  return attachments.map((attachment) => `${attachment.kind}:${attachment.fileName}:${attachment.byteSize}:${attachment.mimeType}`).join("|");
}

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

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiMember();
  if ("error" in auth) {
    return auth.error;
  }

  const { conversationId } = await params;
  const conversation = await getAuthorizedConversation(conversationId, auth.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
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
  });

  return NextResponse.json({
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
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
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const attachmentResult = normalizeAttachments(payload?.attachments);
  if (!attachmentResult.ok) {
    return attachmentErrorResponse(attachmentResult);
  }

  const attachments = attachmentResult.attachments;

  if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Keep messages under ${MAX_CHAT_MESSAGE_LENGTH} characters.` }, { status: 400 });
  }

  if (!body && attachments.length === 0) {
    return NextResponse.json({ error: "Message text or an attachment is required." }, { status: 400 });
  }

  const duplicateSince = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
  const latestMessage = await prisma.message.findFirst({
    where: {
      conversationId,
      senderUserId: auth.user.id,
      deletedAt: null,
      createdAt: { gte: duplicateSince },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          kind: true,
          fileName: true,
          byteSize: true,
          mimeType: true,
        },
      },
    },
  });

  const incomingAttachmentSignature = buildDuplicateAttachmentSignature(attachments);
  const recentAttachmentSignature = latestMessage
    ? buildDuplicateAttachmentSignature(
        latestMessage.attachments.map((attachment) => ({
          kind: attachment.kind,
          fileName: attachment.fileName,
          byteSize: attachment.byteSize,
          mimeType: attachment.mimeType,
          storageKey: "",
        })),
      )
    : null;

  if (latestMessage && latestMessage.body === body && incomingAttachmentSignature === recentAttachmentSignature) {
    return NextResponse.json({ error: "That message is already being sent." }, { status: 409 });
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          conversationId,
          senderUserId: auth.user.id,
          body,
          attachments: attachments.length
            ? {
                create: attachments,
              }
            : undefined,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
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
            },
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return createdMessage;
    });

    return NextResponse.json(
      {
        message: {
          ...message,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "The message could not be saved. Please try again." }, { status: 500 });
  }
}

import { MessageAttachmentKind } from "@prisma/client";

export const MAX_CHAT_ATTACHMENTS = 4;
export const MAX_CHAT_ATTACHMENT_BYTES = 2_000_000;
export const MAX_CHAT_MESSAGE_LENGTH = 4_000;
export const CHAT_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
] as const;

export type ChatAttachmentMimeType = (typeof CHAT_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

export type ChatAttachmentInput = {
  kind: MessageAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
};

export type ChatAttachmentValidationIssue =
  | "invalid"
  | "missing_data"
  | "too_large"
  | "too_many"
  | "unsupported_type";

export function isAllowedChatAttachmentMimeType(mimeType: string) {
  return CHAT_ATTACHMENT_ALLOWED_MIME_TYPES.includes(mimeType as ChatAttachmentMimeType);
}

export function isImageAttachmentMimeType(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function parseDataUrlMimeType(storageKey: string) {
  const match = /^data:([^;,]+)[;,]/i.exec(storageKey);
  return match?.[1]?.toLowerCase() ?? null;
}

export function getChatAttachmentValidationMessage(issue: ChatAttachmentValidationIssue, fileName?: string) {
  switch (issue) {
    case "too_many":
      return `Attach up to ${MAX_CHAT_ATTACHMENTS} files per message.`;
    case "too_large":
      return `${fileName ?? "This file"} is too large. Keep attachments under 2 MB.`;
    case "unsupported_type":
      return `${fileName ?? "This file"} is not a supported file type.`;
    case "missing_data":
      return `${fileName ?? "This file"} could not be processed. Please try again.`;
    default:
      return `${fileName ?? "This attachment"} is invalid.`;
  }
}

export function validateChatAttachmentInput(value: unknown):
  | { ok: true; attachment: ChatAttachmentInput }
  | { ok: false; issue: ChatAttachmentValidationIssue; fileName?: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, issue: "invalid" };
  }

  const attachment = value as Record<string, unknown>;
  const kind = attachment.kind === MessageAttachmentKind.IMAGE ? MessageAttachmentKind.IMAGE : MessageAttachmentKind.FILE;
  const fileName = typeof attachment.fileName === "string" ? attachment.fileName.trim() : "";
  const mimeType = typeof attachment.mimeType === "string" ? attachment.mimeType.trim().toLowerCase() : "";
  const byteSize = typeof attachment.byteSize === "number" ? attachment.byteSize : Number(attachment.byteSize ?? 0);
  const storageKey = typeof attachment.storageKey === "string" ? attachment.storageKey : "";
  const dataUrlMimeType = parseDataUrlMimeType(storageKey);

  if (!fileName || !storageKey.startsWith("data:") || !dataUrlMimeType) {
    return { ok: false, issue: "missing_data", fileName };
  }

  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_CHAT_ATTACHMENT_BYTES) {
    return { ok: false, issue: "too_large", fileName };
  }

  if (!mimeType || mimeType !== dataUrlMimeType || !isAllowedChatAttachmentMimeType(mimeType)) {
    return { ok: false, issue: "unsupported_type", fileName };
  }

  return {
    ok: true,
    attachment: {
      kind: isImageAttachmentMimeType(mimeType) ? MessageAttachmentKind.IMAGE : kind,
      fileName,
      mimeType,
      byteSize,
      storageKey,
    },
  };
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Camera, FileText, ImagePlus, Paperclip, Send, X } from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";
import { RelativeTime } from "@/components/relative-time";
import { ContextualPushPrompt } from "@/components/contextual-push-prompt";
import {
  getChatAttachmentValidationMessage,
  isAllowedChatAttachmentMimeType,
  isImageAttachmentMimeType,
  MAX_CHAT_ATTACHMENTS,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_MESSAGE_LENGTH,
} from "@/lib/chat-attachments";

type MessageAttachmentKind = "IMAGE" | "FILE";
type MessageStatus = "sending" | "sent" | "failed";
type ModerationTargetType = "MESSAGE" | "MESSAGE_ATTACHMENT";

type Attachment = {
  id: string;
  kind: MessageAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  deletedAt: string | null;
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  senderUserId: string;
  attachments: Attachment[];
  status?: MessageStatus;
};

const REPORT_REASONS = [
  { value: "HARASSMENT", label: "Harassment" },
  { value: "NON_CONSENSUAL_CONTENT", label: "Non-consensual content" },
  { value: "SPAM", label: "Spam" },
  { value: "ILLEGAL_CONTENT", label: "Illegal content" },
  { value: "OTHER", label: "Other" },
] as const;

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function createTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const storageKey = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

  return {
    id: createTempId(),
    kind: isImageAttachmentMimeType(file.type) ? "IMAGE" : "FILE",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    storageKey,
    deletedAt: null,
  };
}

export function ConversationThread({
  conversationId,
  initialMessages,
  otherUserName,
  viewerId,
  enablePushPrompt = false,
  pushPromptVariant = "messages",
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  otherUserName: string;
  viewerId: string;
  enablePushPrompt?: boolean;
  pushPromptVariant?: "messages" | "buddy";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationSuccess, setModerationSuccess] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<{ type: ModerationTargetType; id: string } | null>(null);
  const [moderationReason, setModerationReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("HARASSMENT");
  const [moderationDetails, setModerationDetails] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const sendLockedRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 52)}px`;
  }, [body]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        setIsRefreshing(true);
        const response = await fetch(`/api/conversations/${conversationId}/messages`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { messages: ChatMessage[] };
        setMessages((current) => {
          const pendingOrFailed = current.filter((message) => message.status && message.id.startsWith("temp-"));
          return [...payload.messages, ...pendingOrFailed];
        });
      } finally {
        setIsRefreshing(false);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [conversationId]);

  const hasDraftContent = body.trim().length > 0 || attachments.length > 0;

  async function appendFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;

    setComposerError(null);
    const currentCount = attachments.length;
    const incomingFiles = Array.from(fileList);
    if (currentCount + incomingFiles.length > MAX_CHAT_ATTACHMENTS) {
      setComposerError(getChatAttachmentValidationMessage("too_many"));
      return;
    }

    const nextAttachments: Attachment[] = [];

    for (const file of incomingFiles) {
      if (!isAllowedChatAttachmentMimeType(file.type || "")) {
        setComposerError(getChatAttachmentValidationMessage("unsupported_type", file.name));
        return;
      }

      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        setComposerError(getChatAttachmentValidationMessage("too_large", file.name));
        return;
      }

      try {
        nextAttachments.push(await fileToAttachment(file));
      } catch {
        setComposerError(getChatAttachmentValidationMessage("missing_data", file.name));
        return;
      }
    }

    setAttachments((current) => [...current, ...nextAttachments]);
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }

  function handleEmojiSelect(emoji: string) {
    setBody((current) => `${current}${emoji}`);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function handleSubmit() {
    if (!hasDraftContent || isPending || sendLockedRef.current) {
      return;
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length > MAX_CHAT_MESSAGE_LENGTH) {
      setComposerError(`Keep messages under ${MAX_CHAT_MESSAGE_LENGTH} characters.`);
      return;
    }

    setComposerError(null);
    sendLockedRef.current = true;

    const optimisticId = createTempId();
    const submittedBody = body;
    const submittedAttachments = [...attachments];
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      body: trimmedBody,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      senderUserId: viewerId,
      attachments: submittedAttachments,
      status: "sending",
    };

    setMessages((current) => [...current, optimisticMessage]);
    setBody("");
    setAttachments([]);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: submittedBody, attachments: submittedAttachments }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Message could not be sent.");
        }

        const payload = (await response.json()) as { message: ChatMessage };
        setMessages((current) => current.map((message) => (message.id === optimisticId ? { ...payload.message, status: "sent" } : message)));
        if (enablePushPrompt) {
          setShowPushPrompt(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Message could not be sent.";
        setComposerError(message);
        setBody(submittedBody);
        setAttachments(submittedAttachments);
        setMessages((current) => current.filter((item) => item.id !== optimisticId));
      } finally {
        sendLockedRef.current = false;
      }
    });
  }

  async function submitModeration(action: "report" | "delete", targetType: ModerationTargetType, targetId: string) {
    setModerationError(null);
    setModerationSuccess(null);

    const response = await fetch(`/api/conversations/${conversationId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        targetType,
        targetId,
        reasonCode: moderationReason,
        details: moderationDetails,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setModerationError(payload?.error ?? "This action could not be completed.");
      return;
    }

    if (action === "delete" && targetType === "MESSAGE") {
      setMessages((current) => current.map((message) => (message.id === targetId ? { ...message, deletedAt: new Date().toISOString() } : message)));
    }

    if (action === "delete" && targetType === "MESSAGE_ATTACHMENT") {
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          attachments: message.attachments.map((attachment) =>
            attachment.id === targetId ? { ...attachment, deletedAt: new Date().toISOString() } : attachment,
          ),
        })),
      );
    }

    setModerationSuccess(payload?.message ?? (action === "report" ? "Report submitted." : "Content removed."));
    setModerationTarget(null);
    setModerationDetails("");
    setModerationReason("HARASSMENT");
  }

  const orderedMessages = useMemo(
    () => [...messages].sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()),
    [messages],
  );

  return (
    <section className="lux-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b lux-divider pb-4">
        <div>
          <p className="lux-overline">Private messages</p>
          <p className="mt-2 text-sm text-[color:var(--lux-text-secondary)]">{isRefreshing ? "Refreshing conversation..." : `Direct messages with ${otherUserName}`}</p>
        </div>
      </div>

      <div className="mt-5 flex max-h-[72vh] min-h-[48vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {orderedMessages.length === 0 ? (
            <div className="lux-empty">No messages yet. Start the conversation below.</div>
          ) : (
            orderedMessages.map((message) => {
              const isMine = message.senderUserId === viewerId;
              const isRemoved = Boolean(message.deletedAt);
              return (
                <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] space-y-2 rounded-[1.15rem] px-4 py-3 shadow-sm md:max-w-[82%] ${
                      isMine
                        ? "border border-[color:rgba(124,74,110,0.12)] bg-[linear-gradient(180deg,#7c4a6e_0%,#5e3554_100%)] text-white"
                        : "border border-[color:var(--lux-border)] bg-white text-[color:var(--lux-text)]"
                    }`}
                  >
                    {isRemoved ? (
                      <p className={`text-sm italic ${isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"}`}>This content was removed.</p>
                    ) : message.body ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.body}</p>
                    ) : null}
                    {!isRemoved && message.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {message.attachments.map((attachment) =>
                          attachment.deletedAt ? (
                            <div key={attachment.id} className={`rounded-[0.9rem] border px-3 py-3 text-sm ${isMine ? "border-white/20 bg-white/10 text-white/80" : "border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] text-[color:var(--lux-text-muted)]"}`}>
                              This content was removed.
                            </div>
                          ) : attachment.kind === "IMAGE" ? (
                            <div className="space-y-2" key={attachment.id}>
                              <a className="block overflow-hidden rounded-[0.9rem] border border-white/20 bg-white/10" href={attachment.storageKey} rel="noreferrer" target="_blank">
                                <Image alt={attachment.fileName} className="max-h-64 w-full object-cover" height={512} src={attachment.storageKey} unoptimized width={512} />
                              </a>
                              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] uppercase tracking-[0.14em]">
                                {isMine ? (
                                  <button className={isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"} onClick={() => void submitModeration("delete", "MESSAGE_ATTACHMENT", attachment.id)} type="button">Remove</button>
                                ) : null}
                                <button className={isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"} onClick={() => setModerationTarget({ type: "MESSAGE_ATTACHMENT", id: attachment.id })} type="button">Report</button>
                              </div>
                            </div>
                          ) : (
                            <div key={attachment.id} className="space-y-2">
                              <a
                                className={`flex items-center gap-3 rounded-[0.9rem] border px-3 py-3 text-sm ${
                                  isMine ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] text-[color:var(--lux-text)]"
                                }`}
                                download={attachment.fileName}
                                href={attachment.storageKey}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{attachment.fileName}</p>
                                  <p className={`text-xs ${isMine ? "text-white/70" : "text-[color:var(--lux-text-muted)]"}`}>{formatBytes(attachment.byteSize)}</p>
                                </div>
                              </a>
                              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] uppercase tracking-[0.14em]">
                                {isMine ? (
                                  <button className={isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"} onClick={() => void submitModeration("delete", "MESSAGE_ATTACHMENT", attachment.id)} type="button">Remove</button>
                                ) : null}
                                <button className={isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"} onClick={() => setModerationTarget({ type: "MESSAGE_ATTACHMENT", id: attachment.id })} type="button">Report</button>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                    <div className={`flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] ${isMine ? "text-white/70" : "text-[color:var(--lux-text-muted)]"}`}>
                      <div className="flex items-center gap-2">
                        {!isRemoved ? <button className={isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"} onClick={() => setModerationTarget({ type: "MESSAGE", id: message.id })} type="button">Report</button> : null}
                        {isMine && !isRemoved ? <button className={isMine ? "text-white/80" : "text-[color:var(--lux-text-muted)]"} onClick={() => void submitModeration("delete", "MESSAGE", message.id)} type="button">Remove</button> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {message.status === "sending" ? <span>Sending</span> : null}
                        {message.status === "failed" ? <span className="text-rose-200">Failed</span> : null}
                        <RelativeTime value={message.createdAt} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        <div className="sticky bottom-0 mt-5 border-t lux-divider bg-[color:var(--lux-card)] pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-4">
          {showPushPrompt ? (
            <ContextualPushPrompt
              body={pushPromptVariant === "buddy" ? "Want instant alerts for Buddy updates and replies?" : "Want instant alerts for messages and requests?"}
              title="Enable instant alerts"
            />
          ) : null}
          {moderationError ? <div className="mb-3 rounded-[0.9rem] border border-[color:rgba(138,89,100,0.18)] bg-[color:rgba(138,89,100,0.08)] px-3 py-3 text-sm text-[color:var(--lux-danger)]">{moderationError}</div> : null}
          {moderationSuccess ? <div className="mb-3 rounded-[0.9rem] border border-[color:rgba(71,142,98,0.18)] bg-[rgba(71,142,98,0.08)] px-3 py-3 text-sm text-emerald-700">{moderationSuccess}</div> : null}
          {moderationTarget ? (
            <div className="mb-3 rounded-[0.95rem] border border-[color:var(--lux-border)] bg-white px-4 py-4 shadow-[0_8px_20px_rgba(43,43,43,0.035)]">
              <p className="text-sm font-medium text-[color:var(--lux-text)]">Report content</p>
              <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                <select className="rounded-[0.8rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] px-3 py-2 text-sm" onChange={(event) => setModerationReason(event.target.value as (typeof REPORT_REASONS)[number]["value"])} value={moderationReason}>
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
                <input className="rounded-[0.8rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] px-3 py-2 text-sm" onChange={(event) => setModerationDetails(event.target.value)} placeholder="Optional details" value={moderationDetails} />
                <div className="flex gap-2">
                  <button className="lux-button-secondary" onClick={() => setModerationTarget(null)} type="button">Cancel</button>
                  <button className="lux-button-primary" onClick={() => void submitModeration("report", moderationTarget.type, moderationTarget.id)} type="button">Submit</button>
                </div>
              </div>
            </div>
          ) : null}
          {composerError ? (
            <div className="mb-3 flex items-start gap-2 rounded-[0.95rem] border border-[color:rgba(138,89,100,0.18)] bg-[color:rgba(138,89,100,0.08)] px-3 py-3 text-sm text-[color:var(--lux-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{composerError}</span>
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[color:var(--lux-border)] bg-white px-3 py-2 text-xs text-[color:var(--lux-text-secondary)]" key={attachment.id}>
                  <span className="truncate max-w-[180px]">{attachment.fileName}</span>
                  <button onClick={() => removeAttachment(attachment.id)} type="button">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(43,43,43,0.035)]">
            <textarea
              ref={textareaRef}
              className="min-h-[52px] w-full resize-none overflow-hidden bg-transparent text-sm leading-7 text-[color:var(--lux-text)] outline-none placeholder:text-[color:var(--lux-text-muted)]"
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files ?? []);
                if (files.length > 0) {
                  event.preventDefault();
                  void appendFiles(files);
                }
              }}
              placeholder={`Write a message to ${otherUserName}`}
              rows={1}
              value={body}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--lux-border)] pt-3">
              <div className="flex flex-wrap items-center gap-2 text-[color:var(--lux-text-muted)]">
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]" onClick={() => imageInputRef.current?.click()} type="button">
                  <ImagePlus className="h-4 w-4" />
                </button>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]" onClick={() => fileInputRef.current?.click()} type="button">
                  <Paperclip className="h-4 w-4" />
                </button>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]" onClick={() => cameraInputRef.current?.click()} type="button">
                  <Camera className="h-4 w-4" />
                </button>
                <EmojiPicker onSelect={handleEmojiSelect} />
              </div>

              <button className="lux-button-primary gap-2 shrink-0" disabled={!hasDraftContent || isPending} onClick={() => void handleSubmit()} type="button">
                <Send className="h-4 w-4" />
                {isPending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>

          <input accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" className="hidden" multiple onChange={(event) => void appendFiles(event.target.files)} ref={imageInputRef} type="file" />
          <input accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" multiple onChange={(event) => void appendFiles(event.target.files)} ref={fileInputRef} type="file" />
          <input accept="image/*" capture="environment" className="hidden" onChange={(event) => void appendFiles(event.target.files)} ref={cameraInputRef} type="file" />
        </div>
      </div>
    </section>
  );
}

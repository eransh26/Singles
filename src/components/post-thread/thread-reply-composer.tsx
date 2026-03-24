"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircleMore, SendHorizonal, Sparkles } from "lucide-react";
import { PREMIUM_ACTION_ACCENT, PREMIUM_CHIP, PREMIUM_COMPOSER_SHELL, PREMIUM_COMPOSER_SHELL_ACTIVE, PREMIUM_INPUT_SHELL, PREMIUM_META } from "@/components/ui/premium-styles";

type ThreadReplyComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
  postId: string;
  viewerName: string;
};

const PLACEHOLDERS = ["Reply to the circle...", "Join the conversation...", "Say something..."];

export function ThreadReplyComposer({ action, postId, viewerName }: ThreadReplyComposerProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const placeholder = useMemo(() => PLACEHOLDERS[postId.length % PLACEHOLDERS.length], [postId]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, expanded ? 104 : 44)}px`;
  }, [content, expanded]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) {
      return;
    }

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("contentText", trimmed);

    setSending(true);
    setError(null);
    setFeedback(null);

    try {
      await action(formData);
      setContent("");
      setExpanded(true);
      setFeedback("Sent to the thread");
      router.refresh();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Reply could not be sent.");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      className={`mt-4 p-4 md:p-4 ${PREMIUM_COMPOSER_SHELL} ${expanded ? PREMIUM_COMPOSER_SHELL_ACTIVE : ""}`}
      data-expanded={expanded ? "true" : "false"}
      data-testid="thread-reply-composer"
      onSubmit={handleSubmit}
    >
      <input name="postId" type="hidden" value={postId} />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-sm font-semibold text-white/88">
          {viewerName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/88">Reply as {viewerName}</p>
              <p className={`${PREMIUM_META} mt-1`}>Visible inside this thread</p>
            </div>
          </div>

          <div className={PREMIUM_INPUT_SHELL}>
            <textarea
              ref={textareaRef}
              className="min-h-[44px] w-full resize-none bg-transparent text-[15px] leading-6 text-white outline-none placeholder:text-white/38"
              data-testid="thread-reply-input"
              name="contentText"
              onChange={(event) => setContent(event.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder={placeholder}
              rows={1}
              value={content}
            />
          </div>

          <div className={`grid transition-all duration-200 ${expanded || error || feedback ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/52">
                  <span className={PREMIUM_CHIP}>
                    <MessageCircleMore className="h-3.5 w-3.5" />
                    Keep it human
                  </span>
                  <span className={PREMIUM_CHIP}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Short replies land best
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="min-h-[20px] text-xs text-white/58" data-testid="thread-reply-status">
                    {sending ? "Sending..." : error ?? feedback}
                  </div>
                  <button className={PREMIUM_ACTION_ACCENT} data-testid="thread-reply-submit" disabled={!content.trim() || sending} type="submit">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                    {sending ? "Sending" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

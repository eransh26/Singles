"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ban, Flag, Images, MessageCircleMore, ShieldAlert } from "lucide-react";
import { blockUserAction, reportUserAction, sendChatRequestAction, sendPhotoAccessRequestAction } from "@/app/(app)/actions";

type ChatState = "send" | "open" | "pending" | "incoming" | "blocked";
type PhotoState = "request" | "approved" | "pending" | "blocked";

type PostAuthorActionsProps = {
  targetUserId: string;
  sourcePath: string;
  chatState: ChatState;
  photoState: PhotoState;
  conversationId?: string | null;
};

function iconTone(state: "idle" | "pending" | "confirmed" | "blocked") {
  if (state === "confirmed") {
    return "border-[color:rgba(71,142,98,0.24)] bg-[rgba(71,142,98,0.10)] text-emerald-700";
  }
  if (state === "pending") {
    return "border-[color:rgba(201,146,61,0.24)] bg-[rgba(201,146,61,0.10)] text-amber-700";
  }
  if (state === "blocked") {
    return "border-[color:rgba(122,115,118,0.2)] bg-[rgba(122,115,118,0.08)] text-[color:var(--lux-text-muted)]";
  }
  return "border-[color:rgba(109,129,167,0.22)] bg-[rgba(109,129,167,0.08)] text-slate-600";
}

export function PostAuthorActions({ targetUserId, sourcePath, chatState, photoState, conversationId }: PostAuthorActionsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const chatTone = chatState === "open" ? "confirmed" : chatState === "pending" || chatState === "incoming" ? "pending" : chatState === "blocked" ? "blocked" : "idle";
  const photoTone = photoState === "approved" ? "confirmed" : photoState === "pending" ? "pending" : photoState === "blocked" ? "blocked" : "idle";

  return (
    <div className="relative flex items-center gap-1.5" ref={containerRef}>
      {chatState === "open" && conversationId ? (
        <Link className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${iconTone(chatTone)}`} href={`/chats/${conversationId}`} title="Open chat">
          <MessageCircleMore className="h-4 w-4" />
        </Link>
      ) : chatState === "send" ? (
        <form action={sendChatRequestAction}>
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <input name="sourcePath" type="hidden" value={sourcePath} />
          <button className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${iconTone(chatTone)}`} title="Send chat request" type="submit">
            <MessageCircleMore className="h-4 w-4" />
          </button>
        </form>
      ) : chatState === "incoming" ? (
        <Link className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${iconTone(chatTone)}`} href="/chats" title="Review chat request">
          <MessageCircleMore className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${iconTone(chatTone)}`} title={chatState === "pending" ? "Chat request pending" : "Chat unavailable"}>
          <MessageCircleMore className="h-4 w-4" />
        </span>
      )}

      {photoState === "request" ? (
        <form action={sendPhotoAccessRequestAction}>
          <input name="ownerUserId" type="hidden" value={targetUserId} />
          <input name="sourcePath" type="hidden" value={sourcePath} />
          <button className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${iconTone(photoTone)}`} title="Request gallery access" type="submit">
            <Images className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${iconTone(photoTone)}`} title={photoState === "approved" ? "Gallery access approved" : photoState === "pending" ? "Gallery request pending" : "Gallery request unavailable"}>
          <Images className="h-4 w-4" />
        </span>
      )}

      <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:rgba(122,115,118,0.2)] bg-white text-[color:var(--lux-text-muted)] transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]" onClick={() => setMenuOpen((value) => !value)} title="Safety actions" type="button">
        <ShieldAlert className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-10 z-20 w-56 rounded-[1rem] border border-[color:var(--lux-border)] bg-white p-2 shadow-[0_18px_38px_rgba(43,43,43,0.08)]">
          <form action={blockUserAction}>
            <input name="blockedUserId" type="hidden" value={targetUserId} />
            <input name="sourcePath" type="hidden" value={sourcePath} />
            <button className="flex w-full items-center gap-2 rounded-[0.85rem] px-3 py-2 text-left text-sm text-[color:var(--lux-text-secondary)] transition hover:bg-[color:var(--lux-highlight-soft)] hover:text-[color:var(--lux-text)]" type="submit">
              <Ban className="h-4 w-4" />
              Block user
            </button>
          </form>
          <form action={reportUserAction}>
            <input name="targetUserId" type="hidden" value={targetUserId} />
            <input name="sourcePath" type="hidden" value={sourcePath} />
            <input name="details" type="hidden" value="Reported from post header actions." />
            <button className="flex w-full items-center gap-2 rounded-[0.85rem] px-3 py-2 text-left text-sm text-[color:var(--lux-text-secondary)] transition hover:bg-[color:var(--lux-highlight-soft)] hover:text-[color:var(--lux-text)]" type="submit">
              <Flag className="h-4 w-4" />
              Report user
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Ban, Flag, Images, MessageCircleMore, ShieldAlert, Video } from "lucide-react";
import { blockUserAction, reportUserAction, requestVideoConsentAction, sendChatRequestAction, sendPhotoAccessRequestAction } from "@/app/(app)/actions";
import { PREMIUM_PANEL, PREMIUM_TOOL_CHIP } from "@/components/ui/premium-styles";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

type ChatState = "send" | "open" | "pending" | "incoming" | "blocked";
type PhotoState = "request" | "approved" | "pending" | "blocked";
type VideoState = "request" | "approved" | "pending" | "blocked";

type PostAuthorActionsProps = {
  targetUserId: string;
  sourcePath: string;
  chatState: ChatState;
  photoState: PhotoState;
  videoState: VideoState;
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

export function PostAuthorActions({ targetUserId, sourcePath, chatState, photoState, videoState, conversationId }: PostAuthorActionsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const dismissMenu = useCallback(() => setMenuOpen(false), []);

  useDismissibleLayer({ open: menuOpen, onDismiss: dismissMenu, refs: [containerRef], restoreFocusRef: triggerRef });

  const chatTone = chatState === "open" ? "confirmed" : chatState === "pending" || chatState === "incoming" ? "pending" : chatState === "blocked" ? "blocked" : "idle";
  const photoTone = photoState === "approved" ? "confirmed" : photoState === "pending" ? "pending" : photoState === "blocked" ? "blocked" : "idle";
  const videoTone = videoState === "approved" ? "confirmed" : videoState === "pending" ? "pending" : videoState === "blocked" ? "blocked" : "idle";

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

      {videoState === "approved" && conversationId ? (
        <Link className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${iconTone(videoTone)}`} href={`/chats/${conversationId}`} title="Video consent approved">
          <Video className="h-4 w-4" />
        </Link>
      ) : videoState === "request" ? (
        <form action={requestVideoConsentAction}>
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <input name="sourcePath" type="hidden" value={sourcePath} />
          <button className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${iconTone(videoTone)}`} title="Request video approval" type="submit">
            <Video className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${iconTone(videoTone)}`} title={videoState === "pending" ? "Video request pending" : videoState === "approved" ? "Video approved" : "Video requires active chat approval"}>
          <Video className="h-4 w-4" />
        </span>
      )}

      <button className={`${PREMIUM_TOOL_CHIP} h-8 w-8 px-0 text-white/62 hover:text-white`} onClick={() => setMenuOpen((value) => !value)} ref={triggerRef} title="Safety actions" type="button">
        <ShieldAlert className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div className={`absolute right-0 top-10 z-20 w-56 p-2 ${PREMIUM_PANEL}`}>
          <form action={blockUserAction}>
            <input name="blockedUserId" type="hidden" value={targetUserId} />
            <input name="sourcePath" type="hidden" value={sourcePath} />
            <button className="flex w-full items-center gap-2 rounded-[0.85rem] px-3 py-2 text-left text-sm text-white/68 transition hover:bg-[rgba(255,255,255,0.06)] hover:text-white" type="submit">
              <Ban className="h-4 w-4" />
              Block user
            </button>
          </form>
          <form action={reportUserAction}>
            <input name="targetUserId" type="hidden" value={targetUserId} />
            <input name="sourcePath" type="hidden" value={sourcePath} />
            <input name="details" type="hidden" value="Reported from post header actions." />
            <button className="flex w-full items-center gap-2 rounded-[0.85rem] px-3 py-2 text-left text-sm text-white/68 transition hover:bg-[rgba(255,255,255,0.06)] hover:text-white" type="submit">
              <Flag className="h-4 w-4" />
              Report user
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

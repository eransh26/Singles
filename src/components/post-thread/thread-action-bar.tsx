"use client";

import Link from "next/link";
import { HandHeart, MessageCircleMore } from "lucide-react";
import { PostReactionButton } from "@/components/post-reaction-button";
import { ThreadEventParticipationActions } from "@/components/post-thread/thread-event-coordination";
import { PREMIUM_ACTION, PREMIUM_ACTION_ACCENT, PREMIUM_SURFACE_STRONG } from "@/components/ui/premium-styles";

type ThreadActionBarProps = {
  buddyHref?: string;
  buddyLabel?: string;
  postId: string;
  groupId?: string | null;
  reactionCount: number;
  reactionType: "LOVE" | "SUPPORT" | "THUMBS_UP" | "CELEBRATE" | null;
  replyHref: string;
  groupHref?: string;
  revealHref?: string;
  eventRelated?: boolean;
};

export function ThreadActionBar({ buddyHref, buddyLabel = "Buddy", postId, groupId, reactionCount, reactionType, replyHref, groupHref, revealHref, eventRelated = false }: ThreadActionBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-[calc(var(--member-shell-bottom-offset)+0.25rem)] left-1/2 z-30 w-full max-w-[var(--ev-app-width)] -translate-x-1/2 px-3"
      data-testid="thread-action-bar"
    >
      <div className={`mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-[1.5rem] px-3 py-3 md:px-4 ${PREMIUM_SURFACE_STRONG}`}>
        <div className="flex items-center gap-3">
          {!eventRelated ? <PostReactionButton groupId={groupId} initialCount={reactionCount} initialReactionType={reactionType} postId={postId} /> : null}
          <Link className={PREMIUM_ACTION} href={replyHref}>
            <MessageCircleMore className="h-4 w-4" />
            Reply
          </Link>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/58">
          {eventRelated ? <ThreadEventParticipationActions layout="bar" /> : null}
          {buddyHref ? (
            <Link className={PREMIUM_ACTION_ACCENT} data-testid="thread-action-bar-buddy-link" href={buddyHref}>
              <HandHeart className="h-3.5 w-3.5" />
              {buddyLabel}
            </Link>
          ) : null}
          {revealHref ? <Link className={PREMIUM_ACTION} href={revealHref}>Reveal</Link> : null}
          {groupHref && !eventRelated ? <Link className={PREMIUM_ACTION} href={groupHref}>Room</Link> : null}
        </div>
      </div>
    </div>
  );
}

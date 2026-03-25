"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { MediaComposer } from "@/components/media-composer";
import { PostReactionButton } from "@/components/post-reaction-button";
import { PREMIUM_EMPTY_STATE, PREMIUM_PANEL } from "@/components/ui/premium-styles";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

type ReactionType = "LOVE" | "SUPPORT" | "THUMBS_UP" | "CELEBRATE" | null;

type CommentItem = {
  id: string;
  contentText: string;
  createdAt: string;
  authorUserId: string;
  author: {
    id: string;
    displayName: string;
  };
};

type PostEngagementProps = {
  postId: string;
  groupId?: string | null;
  viewerId: string;
  reactionCount: number;
  reactionType: ReactionType;
  commentCount: number;
  comments: CommentItem[];
  commentAction: (formData: FormData) => void | Promise<void>;
  commentPlaceholder: string;
  commentSubmitLabel: string;
  groupHref?: string;
  threadHref?: string;
  requiresEmailVerification?: boolean;
};

export function PostEngagement({
  postId,
  groupId,
  viewerId,
  reactionCount,
  reactionType,
  commentCount,
  comments,
  commentAction,
  commentPlaceholder,
  commentSubmitLabel,
  groupHref,
  threadHref,
  requiresEmailVerification = false,
}: PostEngagementProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const commentsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dismissComments = useCallback(() => setCommentsOpen(false), []);

  useDismissibleLayer({ open: commentsOpen, onDismiss: dismissComments, refs: [commentsRef], restoreFocusRef: commentsTriggerRef });

  return (
    <div className="space-y-3 border-t border-[color:var(--lux-border-subtle)] pt-4">
      <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-white/34 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PostReactionButton
          groupId={groupId}
          initialCount={reactionCount}
          initialReactionType={reactionType}
          postId={postId}
        />

        <button
          className={`inline-flex shrink-0 items-center gap-2 transition ${commentsOpen ? "text-white/54" : "hover:text-white/48"}`}
          ref={commentsTriggerRef}
          onClick={() => setCommentsOpen((value) => !value)}
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{commentCount}</span>
        </button>

        {threadHref ? (
          <Link className="inline-flex shrink-0 items-center gap-2 text-white/32 hover:text-white/48" href={threadHref}>
            Thread
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}

        {groupHref ? (
          <Link className="inline-flex shrink-0 items-center gap-2 text-white/32 hover:text-white/48" href={groupHref}>
            Group
          </Link>
        ) : null}
      </div>

      {commentsOpen ? (
        <div className={`p-4 ${PREMIUM_PANEL}`} ref={commentsRef}>
          <div className="space-y-3">
            {comments.length === 0 ? (
              <div className={PREMIUM_EMPTY_STATE}>
                <p className="font-medium text-white/84">No replies yet</p>
                <p className="mt-2 leading-6 text-white/62">A small reply is enough to keep the thread feeling alive.</p>
              </div>
            ) : (
              comments.map((comment) => {
                const commentAuthorHref = comment.authorUserId === viewerId ? "/me" : `/users/${comment.author.id}`;

                return (
                  <div key={comment.id} className="rounded-[1rem] border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.024)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Link className="font-medium normal-case tracking-normal text-white/88 underline-offset-4 hover:underline" href={commentAuthorHref}>
                        {comment.author.displayName}
                      </Link>
                      <RelativeTime className="text-[11px] tracking-normal text-white/40" value={comment.createdAt} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm normal-case leading-6 tracking-normal text-white/72">{comment.contentText}</p>
                  </div>
                );
              })
            )}
          </div>
          {requiresEmailVerification ? (
            <div className="mt-4 rounded-[1rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm normal-case tracking-normal text-white/62">
              Verify your email before replying here.
              <div className="mt-3">
                <Link className="lux-button-secondary" href="/onboarding?step=3">Verify email</Link>
              </div>
            </div>
          ) : (
            <MediaComposer
              action={commentAction}
              compact
              formClassName="mt-4 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.07)] pt-4"
              hiddenFields={[{ name: "postId", value: postId }]}
              placeholder={commentPlaceholder}
              submitLabel={commentSubmitLabel}
              textareaClassName="border-transparent bg-transparent text-white/86 placeholder:text-white/28"
              tone="dark"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

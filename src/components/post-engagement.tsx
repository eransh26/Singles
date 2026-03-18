"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { MediaComposer } from "@/components/media-composer";
import { PostReactionButton } from "@/components/post-reaction-button";

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
}: PostEngagementProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <div className="space-y-4 border-t border-[color:var(--lux-border)] pt-3">
      <div className="flex items-center gap-5 overflow-x-auto whitespace-nowrap text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PostReactionButton
          groupId={groupId}
          initialCount={reactionCount}
          initialReactionType={reactionType}
          postId={postId}
        />

        <button
          className={`inline-flex shrink-0 items-center gap-2 transition ${commentsOpen ? "text-[color:var(--lux-accent-deep)]" : "hover:text-[color:var(--lux-text-secondary)]"}`}
          onClick={() => setCommentsOpen((value) => !value)}
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{commentCount}</span>
        </button>

        {groupHref ? (
          <Link className="inline-flex shrink-0 items-center gap-2 hover:text-[color:var(--lux-text-secondary)]" href={groupHref}>
            Open group
          </Link>
        ) : null}
      </div>

      {commentsOpen ? (
        <div className="rounded-[1.1rem] border border-[color:var(--lux-border-soft)] bg-[color:rgba(250,247,248,0.72)] p-4">
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm normal-case tracking-normal text-[color:var(--lux-text-muted)]">No comments yet.</p>
            ) : (
              comments.map((comment) => {
                const commentAuthorHref = comment.authorUserId === viewerId ? "/me" : `/users/${comment.author.id}`;

                return (
                  <div key={comment.id} className="lux-panel">
                    <div className="flex items-center justify-between gap-3">
                      <Link className="font-medium normal-case tracking-normal text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={commentAuthorHref}>
                        {comment.author.displayName}
                      </Link>
                      <RelativeTime className="text-[11px] tracking-normal text-[color:var(--lux-text-muted)]" value={comment.createdAt} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm normal-case tracking-normal leading-6 text-[color:var(--lux-text-secondary)]">{comment.contentText}</p>
                  </div>
                );
              })
            )}
          </div>
          <MediaComposer
            action={commentAction}
            compact
            formClassName="mt-4 flex flex-col gap-3 border-t border-[color:var(--lux-border)] pt-4"
            hiddenFields={[{ name: "postId", value: postId }]}
            placeholder={commentPlaceholder}
            submitLabel={commentSubmitLabel}
            textareaClassName="min-h-[74px]"
          />
        </div>
      ) : null}
    </div>
  );
}

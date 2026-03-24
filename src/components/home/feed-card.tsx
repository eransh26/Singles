import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { PostEngagement } from "@/components/post-engagement";
import { HomeBlurredMedia } from "./blurred-media";
import { HomeTrustBadge } from "./trust-badge";
import { PREMIUM_BODY, PREMIUM_META, PREMIUM_SURFACE_STRONG } from "@/components/ui/premium-styles";

type ReactionType = "LOVE" | "SUPPORT" | "THUMBS_UP" | "CELEBRATE" | null;

type FeedComment = {
  id: string;
  contentText: string;
  createdAt: string;
  authorUserId: string;
  author: {
    id: string;
    displayName: string;
  };
};

type HomeFeedCardProps = {
  post: {
    id: string;
    contentText: string;
    sensitivityStatus: string;
    createdAt: string;
    media: Array<{ id: string; storageKey: string }>;
    group: { id: string; name: string } | null;
    authorUserId: string;
    authorLabel: string;
    authorHref: string | null;
    authorInitial: string;
    trustTier: "LOW" | "NORMAL" | "HIGH" | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    trustSummary?: string | null;
    visibilityNote?: string | null;
    canOpenAuthorProfile: boolean;
    comments: FeedComment[];
    reactionCount: number;
    reactionType: ReactionType;
    commentCount: number;
  };
  viewerId: string;
  commentAction: (formData: FormData) => void | Promise<void>;
  authorActions?: React.ReactNode;
};

export function HomeFeedCard({ post, viewerId, commentAction, authorActions }: HomeFeedCardProps) {
  const isSensitive = post.sensitivityStatus !== "NORMAL";

  return (
    <article className={`${PREMIUM_SURFACE_STRONG} p-4 md:p-5 hover:-translate-y-0.5`} data-testid="home-feed-card">
      <div className="flex flex-col gap-4.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-sm font-semibold text-white/88">
              {post.authorInitial}
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                {post.authorHref && post.canOpenAuthorProfile ? (
                  <Link className="truncate text-[1rem] font-semibold tracking-tight text-white underline-offset-4 hover:underline" href={post.authorHref}>
                    {post.authorLabel}
                  </Link>
                ) : (
                  <p className="truncate text-[1rem] font-semibold tracking-tight text-white">{post.authorLabel}</p>
                )}
                <HomeTrustBadge compact emailVerified={post.emailVerified} phoneVerified={post.phoneVerified} tier={post.trustTier as never} />
              </div>
              <div className={`flex flex-wrap items-center gap-2 ${PREMIUM_META}`}>
                <span>{post.group ? post.group.name : "Community pulse"}</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <RelativeTime className="tracking-[0.08em] text-white/38" value={post.createdAt} />
              </div>
              {post.visibilityNote ? <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--lux-text-muted)]">{post.visibilityNote}</p> : null}
            </div>
          </div>
          {authorActions ? <div className="flex flex-none items-center gap-2">{authorActions}</div> : null}
        </div>

        <p className={`${PREMIUM_BODY} whitespace-pre-wrap text-[15px] leading-7 text-white/84`}>{post.contentText}</p>

        {post.media.length > 0 ? (
          <div className="space-y-3">
            {post.media.map((media) => (
              <HomeBlurredMedia
                alt="Post media"
                href={isSensitive ? `/validation/sensitive-content?postId=${post.id}` : undefined}
                key={media.id}
                sensitive={isSensitive}
                src={media.storageKey}
              />
            ))}
          </div>
        ) : null}

        <PostEngagement
          commentAction={commentAction}
          commentCount={post.commentCount}
          commentPlaceholder="Reply discreetly..."
          commentSubmitLabel="Reply"
          comments={post.comments}
          groupHref={post.group ? `/groups/${post.group.id}` : undefined}
          postId={post.id}
          reactionCount={post.reactionCount}
          reactionType={post.reactionType}
          threadHref={`/posts/${post.id}`}
          viewerId={viewerId}
        />
      </div>
    </article>
  );
}

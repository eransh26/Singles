import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { RelativeTime } from "@/components/relative-time";
import { HomeTrustBadge } from "./trust-badge";
import { PostEngagement } from "@/components/post-engagement";
import { HomeBlurredMedia } from "./blurred-media";
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
    kycVerified?: boolean;
    verificationStatus?: VerificationStatus | null;
    isBuddyApproved?: boolean;
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
  requiresEmailVerification?: boolean;
};

export function HomeFeedCard({ post, viewerId, commentAction, authorActions, requiresEmailVerification = false }: HomeFeedCardProps) {
  const isSensitive = post.sensitivityStatus !== "NORMAL";

  return (
    <article className={`${PREMIUM_SURFACE_STRONG} ${post.group ? "ev-rail-gold" : "ev-rail-sage"} p-4 md:p-5 hover:-translate-y-0.5`} data-testid="home-feed-card">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3.5">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[1.1rem] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top,rgba(212,176,123,0.12),rgba(255,255,255,0.03)_72%)] text-sm font-semibold text-white/84 shadow-[0_8px_18px_rgba(18,12,9,0.08)]">
              {post.authorInitial}
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                {post.authorHref && post.canOpenAuthorProfile ? (
                  <Link className="truncate text-[1rem] font-semibold tracking-tight text-white/92 underline-offset-4 hover:text-white hover:underline" href={post.authorHref}>
                    {post.authorLabel}
                  </Link>
                ) : (
                  <p className="truncate text-[1rem] font-semibold tracking-tight text-white/90">{post.authorLabel}</p>
                )}
                <HomeTrustBadge compact emailVerified={post.emailVerified} isBuddyApproved={post.isBuddyApproved} kycVerified={post.kycVerified} phoneVerified={post.phoneVerified} tier={post.trustTier as never} verificationStatus={post.verificationStatus} />
              </div>
              <div className={`flex flex-wrap items-center gap-2 ${PREMIUM_META}`}>
                <span>{post.group ? post.group.name : "Community pulse"}</span>
                <span className="h-1 w-1 rounded-full bg-white/16" />
                <RelativeTime className="tracking-[0.08em] text-white/34" value={post.createdAt} />
              </div>
              {post.visibilityNote ? <p className="text-[11px] tracking-[0.12em] text-[color:var(--lux-text-muted)]">{post.visibilityNote}</p> : null}
            </div>
          </div>
          {authorActions ? <div className="flex flex-none items-center gap-2 pt-0.5">{authorActions}</div> : null}
        </div>

        <div className="space-y-3">
          <p className={`${PREMIUM_BODY} whitespace-pre-wrap text-[15px] leading-7 text-white/84`}>{post.contentText}</p>
        </div>

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
          commentPlaceholder="Reply with something small..."
          commentSubmitLabel="Reply"
          comments={post.comments}
          groupHref={post.group ? `/groups/${post.group.id}` : undefined}
          postId={post.id}
          reactionCount={post.reactionCount}
          reactionType={post.reactionType}
          threadHref={`/posts/${post.id}`}
          viewerId={viewerId}
          requiresEmailVerification={requiresEmailVerification}
        />
      </div>
    </article>
  );
}

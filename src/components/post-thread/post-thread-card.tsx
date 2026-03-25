import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { RelativeTime } from "@/components/relative-time";
import { HomeBlurredMedia } from "@/components/home/blurred-media";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { PREMIUM_BODY, PREMIUM_CHIP, PREMIUM_META, PREMIUM_SURFACE_STRONG } from "@/components/ui/premium-styles";

type ThreadMedia = {
  id: string;
  storageKey: string;
};

type PostThreadCardProps = {
  post: {
    id: string;
    contentText: string;
    sensitivityStatus: string;
    createdAt: string;
    media: ThreadMedia[];
    group: { id: string; name: string } | null;
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
    commentCount: number;
    reactionCount: number;
  };
  authorActions?: React.ReactNode;
};

export function PostThreadCard({ post, authorActions }: PostThreadCardProps) {
  const isSensitive = post.sensitivityStatus !== "NORMAL";

  return (
    <section className={`${PREMIUM_SURFACE_STRONG} p-5 md:p-6`} data-testid="post-thread-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3.5">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-sm font-semibold text-white/88">
            {post.authorInitial}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {post.authorHref ? (
                <Link className="truncate text-[1.125rem] font-semibold tracking-tight text-white underline-offset-4 hover:underline" href={post.authorHref}>
                  {post.authorLabel}
                </Link>
              ) : (
                <p className="truncate text-[1.125rem] font-semibold tracking-tight text-white">{post.authorLabel}</p>
              )}
              <HomeTrustBadge compact emailVerified={post.emailVerified} isBuddyApproved={post.isBuddyApproved} kycVerified={post.kycVerified} phoneVerified={post.phoneVerified} tier={post.trustTier as never} verificationStatus={post.verificationStatus} />
            </div>
            <div className={`flex flex-wrap items-center gap-2 ${PREMIUM_META}`}>
              <span>{post.group ? post.group.name : "Community pulse"}</span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <RelativeTime className="tracking-[0.08em] text-white/45" value={post.createdAt} />
            </div>
            {post.visibilityNote ? <p className="text-[11px] uppercase tracking-[0.18em] text-[#caa77a]">{post.visibilityNote}</p> : null}
          </div>
        </div>
        {authorActions ? <div className="flex flex-none items-center gap-2">{authorActions}</div> : null}
      </div>

      <div className="mt-6 space-y-4">
        <p className={`${PREMIUM_BODY} whitespace-pre-wrap text-[1rem] leading-7 md:text-[1.05rem] md:leading-8`}>{post.contentText}</p>

        {post.media.length > 0 ? (
          <div className="space-y-3" data-testid="thread-media-block">
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
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-white/52">
        <span className={PREMIUM_CHIP}>Replies {post.commentCount}</span>
        <span className={PREMIUM_CHIP}>Interested {post.reactionCount}</span>
        {post.trustSummary ? <span className={`${PREMIUM_CHIP} normal-case tracking-[0.04em]`}>{post.trustSummary}</span> : null}
      </div>
    </section>
  );
}

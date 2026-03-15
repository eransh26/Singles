import Link from "next/link";
import { MembershipStatus, PlacementType, PostContextType, PostVisibilityStatus } from "@prisma/client";
import { createCommentAction, createPostAction } from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getPromotedPlacement } from "@/lib/promotions";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export default async function HomePage() {
  const viewer = await requireUser();

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
    select: { groupId: true },
  });

  const visibleGroupIds = memberships.map((membership) => membership.groupId);

  const [posts, recommendedGroups, promotedPlacement] = await Promise.all([
    prisma.post.findMany({
      where: {
        visibilityStatus: PostVisibilityStatus.VISIBLE,
        OR: [
          { contextType: PostContextType.GLOBAL_FEED },
          {
            contextType: PostContextType.GROUP,
            groupId: { in: visibleGroupIds.length > 0 ? visibleGroupIds : ["__none__"] },
            group: { status: "ACTIVE" },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        contentText: true,
        isAnonymous: true,
        createdAt: true,
        groupId: true,
        authorUserId: true,
        author: { select: { id: true, displayName: true } },
        group: { select: { id: true, name: true } },
        comments: {
          where: { moderationStatus: { not: "REMOVED" } },
          orderBy: { createdAt: "asc" },
          take: 5,
          select: {
            id: true,
            contentText: true,
            createdAt: true,
            authorUserId: true,
            author: { select: { id: true, displayName: true } },
          },
        },
      },
    }),
    prisma.group.findMany({
      where: {
        status: "ACTIVE",
        memberships: { none: { userId: viewer.id, status: MembershipStatus.ACTIVE } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, name: true, description: true, groupType: true },
    }),
    getPromotedPlacement(PlacementType.HOME_FEED_CARD),
  ]);

  return (
    <main className="lux-shell">
      <section className="lux-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="lux-overline">Member home</p>
            <h1 className="lux-title mt-3">A quieter place to share, notice, and respond.</h1>
            <p className="lux-body mt-4">
              Welcome back, {viewer.displayName}. The feed keeps private community activity close at hand without turning the space into a noisy social stream.
            </p>
          </div>
          <div className="flex max-w-xl flex-wrap gap-2.5">
            <span className="lux-chip lux-chip-accent">Visible groups {visibleGroupIds.length}</span>
            <span className="lux-chip">Recent posts {posts.length}</span>
            <Link className="lux-chip" href="/groups">
              Browse groups
            </Link>
          </div>
        </div>
      </section>

      {promotedPlacement ? (
        <section className="lux-card relative overflow-hidden" data-testid="home-promoted-event">
          <div className="absolute inset-y-0 left-0 w-1.5 rounded-full bg-[color:var(--lux-champagne)]" />
          <div className="flex flex-col gap-4 pl-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="lux-overline">Promoted event</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">{promotedPlacement.eventPromotion.title}</h2>
              <p className="lux-body mt-3">
                {promotedPlacement.eventPromotion.description ?? "A promoted community event is currently highlighted here."}
              </p>
              {promotedPlacement.eventPromotion.couponCode ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--lux-gold)]">
                  Coupon {promotedPlacement.eventPromotion.couponCode}
                </p>
              ) : null}
            </div>
            <a className="lux-button-secondary" href={promotedPlacement.eventPromotion.externalLink} rel="noreferrer" target="_blank">
              View promoted event
            </a>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <section className="lux-card">
            <div className="border-b lux-divider pb-5">
              <p className="lux-overline">Share something small</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Compose for the community</h2>
              <p className="lux-body mt-3">
                Keep it short, warm, and intentional. Anonymous posting remains available only in the global feed.
              </p>
            </div>
            <form action={createPostAction} className="mt-5 flex flex-col gap-4">
              <textarea
                className="lux-textarea min-h-36"
                name="contentText"
                placeholder="What feels worth sharing today?"
                required
              />
              <label className="lux-panel flex items-center gap-3 text-sm text-[color:var(--lux-text-secondary)]">
                <input className="size-4 accent-[color:var(--lux-gold)]" name="isAnonymous" type="checkbox" />
                <span>Post anonymously in the global feed</span>
              </label>
              <div className="flex justify-end">
                <button className="lux-button-primary" type="submit">
                  Publish post
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="lux-overline">Latest activity</p>
                <h2 className="lux-section-title mt-2">Community rhythm</h2>
              </div>
            </div>
            {posts.length === 0 ? (
              <div className="lux-empty">No posts yet. Create the first one from the composer above.</div>
            ) : (
              posts.map((post) => {
                const isAnonymousToViewer = post.isAnonymous && post.authorUserId !== viewer.id;
                const isAnonymousAuthorView = post.isAnonymous && post.authorUserId === viewer.id;
                const authorLabel = isAnonymousToViewer ? "Anonymous member" : post.author.displayName;
                const canOpenAuthorProfile = !isAnonymousToViewer;
                const authorProfileHref = post.authorUserId === viewer.id ? "/me" : `/users/${post.author.id}`;

                return (
                  <article key={post.id} className="lux-card">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {canOpenAuthorProfile ? (
                            <Link className="text-base font-semibold tracking-tight text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={authorProfileHref}>
                              {authorLabel}
                            </Link>
                          ) : (
                            <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{authorLabel}</p>
                          )}
                          {isAnonymousAuthorView ? (
                            <span className="lux-chip lux-chip-muted normal-case tracking-normal">Shown only to you. Anonymous to everyone else.</span>
                          ) : null}
                          {post.group ? (
                            <Link className="lux-chip" href={`/groups/${post.group.id}`}>
                              {post.group.name}
                            </Link>
                          ) : (
                            <span className="lux-chip">Global feed</span>
                          )}
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">{formatDateTime(post.createdAt)}</p>
                      </div>
                      {canOpenAuthorProfile ? (
                        <div className="flex flex-wrap gap-2">
                          <Link className="lux-button-secondary" href={authorProfileHref}>
                            {post.authorUserId === viewer.id ? "Open my profile" : "View profile"}
                          </Link>
                          {post.authorUserId !== viewer.id ? (
                            <Link className="lux-button-subtle" href={`/users/${post.author.id}`}>
                              Chat
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--lux-text-secondary)]">{post.contentText}</p>

                    <div className="mt-6 rounded-[1.5rem] border border-[color:var(--lux-border-soft)] bg-[color:rgba(255,255,255,0.34)] p-4 dark:bg-[color:rgba(42,36,31,0.5)]">
                      <p className="lux-overline">Comments</p>
                      <div className="mt-4 space-y-3">
                        {post.comments.length === 0 ? (
                          <p className="text-sm text-[color:var(--lux-text-muted)]">No comments yet.</p>
                        ) : (
                          post.comments.map((comment) => {
                            const commentAuthorHref = comment.authorUserId === viewer.id ? "/me" : `/users/${comment.author.id}`;

                            return (
                              <div key={comment.id} className="lux-panel">
                                <div className="flex items-center justify-between gap-3">
                                  <Link className="font-medium text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={commentAuthorHref}>
                                    {comment.author.displayName}
                                  </Link>
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]">{formatDateTime(comment.createdAt)}</p>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--lux-text-secondary)]">{comment.contentText}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <form action={createCommentAction} className="mt-4 flex flex-col gap-3">
                        <input name="postId" type="hidden" value={post.id} />
                        <textarea
                          className="lux-textarea min-h-20"
                          name="contentText"
                          placeholder="Write a comment"
                          required
                        />
                        <div className="flex justify-end">
                          <button className="lux-button-secondary" type="submit">
                            Add comment
                          </button>
                        </div>
                      </form>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="lux-card">
            <p className="lux-overline">Your spaces</p>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="lux-card-soft">
                <p className="lux-overline">Groups</p>
                <p className="mt-3 text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{visibleGroupIds.length} active memberships</p>
              </div>
              <div className="lux-card-soft">
                <p className="lux-overline">Profile</p>
                <Link className="mt-3 inline-flex text-sm font-medium text-[color:var(--lux-text)] underline underline-offset-4" href="/me">
                  Manage profile and privacy
                </Link>
              </div>
            </div>
          </section>

          <section className="lux-card">
            <div className="flex items-center justify-between gap-3 border-b lux-divider pb-4">
              <div>
                <p className="lux-overline">Recommended next</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--lux-text)]">Groups to explore</h2>
              </div>
              <Link className="text-sm font-medium text-[color:var(--lux-text-secondary)] underline-offset-4 hover:underline" href="/groups">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recommendedGroups.length === 0 ? (
                <p className="text-sm text-[color:var(--lux-text-muted)]">You have explored all current groups.</p>
              ) : (
                recommendedGroups.map((group) => (
                  <Link key={group.id} className="lux-card-soft block transition hover:border-[color:rgba(198,166,107,0.26)]" href={`/groups/${group.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{group.name}</p>
                      <span className="lux-chip">{group.groupType}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{group.description ?? "No description yet."}</p>
                  </Link>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

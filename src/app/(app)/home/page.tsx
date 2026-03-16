import Link from "next/link";
import { Camera, Heart, ImagePlus, MessageCircle, SmilePlus } from "lucide-react";
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

function actionLabel(count: number) {
  if (count === 0) {
    return "Comment";
  }

  return `${count} comment${count === 1 ? "" : "s"}`;
}

export default async function HomePage() {
  const viewer = await requireUser();

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
    select: { groupId: true, group: { select: { id: true, name: true } } },
    take: 5,
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
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_320px] lg:items-start">
        <div className="space-y-4">
          <section className="lux-card p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:rgba(201,167,110,0.18)] bg-[color:rgba(198,166,107,0.1)] text-sm font-semibold text-[color:var(--lux-gold)]">
                {viewer.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-[color:var(--lux-text)]">{viewer.displayName}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">Community feed</p>
              </div>
            </div>
            <form action={createPostAction} className="mt-4 flex flex-col gap-3">
              <textarea
                className="lux-textarea min-h-[112px] border-none bg-[color:rgba(255,255,255,0.34)] px-0 pb-2 pt-1 shadow-none dark:bg-transparent"
                name="contentText"
                placeholder="What would you like to share?"
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:rgba(179,154,136,0.16)] pt-3">
                <div className="flex flex-wrap items-center gap-2 text-[color:var(--lux-text-muted)]">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(179,154,136,0.16)] bg-[color:rgba(255,255,255,0.34)]" title="Image upload coming soon">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(179,154,136,0.16)] bg-[color:rgba(255,255,255,0.34)]" title="Camera capture coming soon">
                    <Camera className="h-4 w-4" />
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(179,154,136,0.16)] bg-[color:rgba(255,255,255,0.34)]" title="Emoji insertion coming soon">
                    <SmilePlus className="h-4 w-4" />
                  </span>
                  <label className="ml-2 inline-flex items-center gap-2 rounded-full border border-[color:rgba(179,154,136,0.16)] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-secondary)]">
                    <input className="size-4 accent-[color:var(--lux-gold)]" name="isAnonymous" type="checkbox" />
                    Anonymous
                  </label>
                </div>
                <button className="lux-button-primary" type="submit">Post</button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            {posts.length === 0 ? (
              <div className="lux-empty">No posts yet. Share the first update above.</div>
            ) : (
              posts.map((post) => {
                const isAnonymousToViewer = post.isAnonymous && post.authorUserId !== viewer.id;
                const isAnonymousAuthorView = post.isAnonymous && post.authorUserId === viewer.id;
                const authorLabel = isAnonymousToViewer ? "Anonymous member" : post.author.displayName;
                const canOpenAuthorProfile = !isAnonymousToViewer;
                const authorProfileHref = post.authorUserId === viewer.id ? "/me" : `/users/${post.author.id}`;

                return (
                  <article key={post.id} className="lux-card p-4 md:p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            {canOpenAuthorProfile ? (
                              <Link className="text-base font-semibold tracking-tight text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={authorProfileHref}>
                                {authorLabel}
                              </Link>
                            ) : (
                              <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{authorLabel}</p>
                            )}
                            {post.group ? <Link className="lux-chip" href={`/groups/${post.group.id}`}>{post.group.name}</Link> : <span className="lux-chip">Global feed</span>}
                            {isAnonymousAuthorView ? <span className="lux-chip lux-chip-muted normal-case tracking-normal">Visible only to you</span> : null}
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">{formatDateTime(post.createdAt)}</p>
                        </div>
                        {canOpenAuthorProfile ? (
                          <Link className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)] underline-offset-4 hover:underline" href={authorProfileHref}>
                            {post.authorUserId === viewer.id ? "My profile" : "View profile"}
                          </Link>
                        ) : null}
                      </div>

                      <p className="whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--lux-text-secondary)]">{post.contentText}</p>

                      <div className="flex flex-wrap items-center gap-4 border-t border-[color:rgba(179,154,136,0.16)] pt-3 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]">
                        <span className="inline-flex items-center gap-2">
                          <Heart className="h-4 w-4" />
                          React
                        </span>

                        <details className="group">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full px-0 py-0 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)] marker:hidden">
                            <MessageCircle className="h-4 w-4" />
                            {actionLabel(post.comments.length)}
                          </summary>
                          <div className="mt-4 min-w-[min(100%,36rem)] rounded-[1.4rem] border border-[color:rgba(179,154,136,0.16)] bg-[color:rgba(255,255,255,0.22)] p-4 dark:bg-[color:rgba(42,36,31,0.48)]">
                            <div className="space-y-3">
                              {post.comments.length === 0 ? (
                                <p className="text-sm normal-case tracking-normal text-[color:var(--lux-text-muted)]">No comments yet.</p>
                              ) : (
                                post.comments.map((comment) => {
                                  const commentAuthorHref = comment.authorUserId === viewer.id ? "/me" : `/users/${comment.author.id}`;

                                  return (
                                    <div key={comment.id} className="lux-panel">
                                      <div className="flex items-center justify-between gap-3">
                                        <Link className="font-medium normal-case tracking-normal text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={commentAuthorHref}>
                                          {comment.author.displayName}
                                        </Link>
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]">{formatDateTime(comment.createdAt)}</p>
                                      </div>
                                      <p className="mt-2 whitespace-pre-wrap text-sm normal-case tracking-normal leading-6 text-[color:var(--lux-text-secondary)]">{comment.contentText}</p>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <form action={createCommentAction} className="mt-4 flex flex-col gap-3 border-t border-[color:rgba(179,154,136,0.14)] pt-4">
                              <input name="postId" type="hidden" value={post.id} />
                              <textarea className="lux-textarea min-h-[108px]" name="contentText" placeholder="Write a comment" required />
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex gap-2 text-[color:var(--lux-text-muted)]">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:rgba(179,154,136,0.16)]"><ImagePlus className="h-4 w-4" /></span>
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:rgba(179,154,136,0.16)]"><Camera className="h-4 w-4" /></span>
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:rgba(179,154,136,0.16)]"><SmilePlus className="h-4 w-4" /></span>
                                </div>
                                <button className="lux-button-secondary" type="submit">Add comment</button>
                              </div>
                            </form>
                          </div>
                        </details>

                        {post.group ? (
                          <Link className="inline-flex items-center gap-2 hover:text-[color:var(--lux-text-secondary)]" href={`/groups/${post.group.id}`}>
                            Open group
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28">
          <section className="lux-card p-4">
            <p className="lux-overline">Your spaces</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {memberships.length === 0 ? (
                <p className="text-sm text-[color:var(--lux-text-muted)]">No active groups yet.</p>
              ) : (
                memberships.map((membership) => (
                  <Link key={membership.group.id} className="lux-chip" href={`/groups/${membership.group.id}`}>
                    {membership.group.name}
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="lux-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="lux-overline">Profile</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">Identity and privacy</h2>
              </div>
              <Link className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)] underline-offset-4 hover:underline" href="/me">
                Open
              </Link>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Refine your member profile, privacy settings, and verification visibility.</p>
          </section>

          {promotedPlacement ? (
            <section className="lux-card p-4" data-testid="home-promoted-event">
              <p className="lux-overline">Featured event</p>
              <h2 className="mt-3 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">{promotedPlacement.eventPromotion.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">
                {promotedPlacement.eventPromotion.description ?? "A promoted community event is currently highlighted here."}
              </p>
              <a className="lux-button-secondary mt-4" href={promotedPlacement.eventPromotion.externalLink} rel="noreferrer" target="_blank">
                View event
              </a>
            </section>
          ) : null}

          <section className="lux-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="lux-overline">Discover</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">Related groups</h2>
              </div>
              <Link className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)] underline-offset-4 hover:underline" href="/groups">
                Browse
              </Link>
            </div>
            <div className="mt-3 space-y-3">
              {recommendedGroups.length === 0 ? (
                <p className="text-sm text-[color:var(--lux-text-muted)]">You have explored all current groups.</p>
              ) : (
                recommendedGroups.map((group) => (
                  <Link key={group.id} className="block rounded-[1.35rem] border border-[color:rgba(179,154,136,0.14)] bg-[color:rgba(255,255,255,0.2)] px-4 py-4 transition hover:border-[color:rgba(198,166,107,0.24)] dark:bg-[color:rgba(42,36,31,0.42)]" href={`/groups/${group.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{group.name}</p>
                      <span className="lux-chip">{group.groupType}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{group.description ?? "No description yet."}</p>
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

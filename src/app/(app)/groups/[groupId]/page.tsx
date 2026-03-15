import Link from "next/link";
import { GroupRole, GroupType, MembershipStatus, PlacementType, PostContextType, PostVisibilityStatus } from "@prisma/client";
import { createCommentAction, createPostAction, joinGroupAction, removeGroupMemberAction, reviewGroupJoinRequestAction, updateGroupAction } from "../../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getPromotedPlacement } from "@/lib/promotions";
import { notFound } from "next/navigation";

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

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const viewer = await requireUser();
  const { groupId } = await params;

  const [group, promotedPlacement] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        groupType: true,
        isSmallPrivateGroup: true,
        status: true,
        createdByUserId: true,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          orderBy: { joinedAt: "asc" },
          select: {
            userId: true,
            role: true,
            user: { select: { id: true, displayName: true } },
          },
        },
        joinRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            requestMessage: true,
            createdAt: true,
            applicant: { select: { id: true, displayName: true } },
          },
        },
        posts: {
          where: { contextType: PostContextType.GROUP, visibilityStatus: PostVisibilityStatus.VISIBLE },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            contentText: true,
            isAnonymous: true,
            createdAt: true,
            authorUserId: true,
            author: { select: { displayName: true } },
            comments: {
              where: { moderationStatus: { not: "REMOVED" } },
              orderBy: { createdAt: "asc" },
              take: 5,
              select: {
                id: true,
                contentText: true,
                createdAt: true,
                author: { select: { displayName: true } },
              },
            },
          },
        },
      },
    }),
    getPromotedPlacement(PlacementType.GROUP_DETAIL_BANNER, groupId),
  ]);

  if (!group || group.status !== "ACTIVE") {
    notFound();
  }

  const membership = group.memberships.find((item) => item.userId === viewer.id);
  const isOwner = group.createdByUserId === viewer.id;
  const isManager = isOwner || membership?.role === GroupRole.MANAGER || membership?.role === GroupRole.OWNER;
  const isMember = isOwner || Boolean(membership);
  const hasPendingRequest = group.joinRequests.some((request) => request.applicant.id === viewer.id);

  return (
    <main className="lux-shell">
      <section className="lux-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="lux-overline">Group space</p>
              <span className="lux-chip">{group.groupType}</span>
              {group.isSmallPrivateGroup ? <span className="lux-chip lux-chip-muted">Small private</span> : null}
            </div>
            <h1 className="lux-title mt-3">{group.name}</h1>
            <p className="lux-body mt-4">{group.description ?? "No group description yet."}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <span className="lux-chip">Members {group.memberships.length}</span>
            <span className="lux-chip">Pending {group.joinRequests.length}</span>
            <span className="lux-chip lux-chip-accent">Posts {group.posts.length}</span>
          </div>
        </div>
      </section>

      {promotedPlacement ? (
        <section className="lux-card relative overflow-hidden" data-testid="group-promoted-event">
          <div className="absolute inset-y-0 left-0 w-1.5 rounded-full bg-[color:var(--lux-mauve)]" />
          <div className="flex flex-col gap-4 pl-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="lux-overline">Promoted event</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">{promotedPlacement.eventPromotion.title}</h2>
              <p className="lux-body mt-3">
                {promotedPlacement.eventPromotion.description ?? "A promoted event is highlighted for this group."}
              </p>
            </div>
            <a className="lux-button-secondary" href={promotedPlacement.eventPromotion.externalLink} rel="noreferrer" target="_blank">
              View promoted event
            </a>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <section className="lux-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="lux-overline">Membership</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Your place in this room</h2>
              </div>
              <div>
                {isOwner ? (
                  <span className="lux-chip lux-chip-accent">Owner</span>
                ) : isMember ? (
                  <span className="lux-chip">Member</span>
                ) : hasPendingRequest ? (
                  <span className="lux-chip">Request pending</span>
                ) : (
                  <form action={joinGroupAction} className="grid gap-3">
                    <input name="groupId" type="hidden" value={group.id} />
                    {group.groupType !== GroupType.OPEN ? (
                      <input className="lux-input" name="requestMessage" placeholder="Optional request note" />
                    ) : null}
                    <button className="lux-button-primary" type="submit">
                      {group.groupType === GroupType.OPEN ? "Join group" : "Request to join"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>

          {isOwner ? (
            <section className="lux-card">
              <div className="border-b lux-divider pb-5">
                <p className="lux-overline">Owner controls</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Edit group details</h2>
              </div>
              <form action={updateGroupAction} className="mt-5 grid gap-3 text-sm text-[color:var(--lux-text-secondary)]">
                <input name="groupId" type="hidden" value={group.id} />
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Group name</span>
                  <input className="lux-input" defaultValue={group.name} name="name" required />
                </label>
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Description</span>
                  <textarea className="lux-textarea min-h-24" defaultValue={group.description ?? ""} name="description" />
                </label>
                <div className="flex justify-end">
                  <button className="lux-button-primary" type="submit">Save group details</button>
                </div>
              </form>
            </section>
          ) : null}

          {isMember ? (
            <section className="lux-card">
              <div className="border-b lux-divider pb-5">
                <p className="lux-overline">Post to this group</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Share with members only</h2>
                <p className="lux-body mt-3">Posts inside groups are shown with your name here.</p>
              </div>
              <form action={createPostAction} className="mt-5 flex flex-col gap-4">
                <input name="groupId" type="hidden" value={group.id} />
                <textarea className="lux-textarea min-h-28" name="contentText" placeholder="Share something relevant with this group" required />
                <div className="flex justify-end">
                  <button className="lux-button-primary" type="submit">Publish to group</button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="lux-overline">Group feed</p>
              <h2 className="lux-section-title mt-2">Latest posts</h2>
            </div>
            {!isMember ? (
              <div className="lux-empty">Join this group to view its internal posts and comments.</div>
            ) : group.posts.length === 0 ? (
              <div className="lux-empty">No group posts yet.</div>
            ) : (
              group.posts.map((post) => {
                const isAnonymousToViewer = post.isAnonymous && post.authorUserId !== viewer.id;
                const isAnonymousAuthorView = post.isAnonymous && post.authorUserId === viewer.id;
                const authorLabel = isAnonymousToViewer ? "Anonymous member" : post.author.displayName;

                return (
                  <article key={post.id} className="lux-card">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{authorLabel}</p>
                          {isAnonymousAuthorView ? (
                            <span className="lux-chip lux-chip-muted normal-case tracking-normal">Shown only to you. Anonymous to everyone else.</span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">{formatDateTime(post.createdAt)}</p>
                      </div>
                    </div>
                    <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--lux-text-secondary)]">{post.contentText}</p>
                    <div className="mt-6 rounded-[1.5rem] border border-[color:var(--lux-border-soft)] bg-[color:rgba(255,255,255,0.34)] p-4 dark:bg-[color:rgba(42,36,31,0.5)]">
                      <p className="lux-overline">Comments</p>
                      <div className="mt-4 space-y-3">
                        {post.comments.length === 0 ? (
                          <p className="text-sm text-[color:var(--lux-text-muted)]">No comments yet.</p>
                        ) : (
                          post.comments.map((comment) => (
                            <div key={comment.id} className="lux-panel">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-[color:var(--lux-text)]">{comment.author.displayName}</p>
                                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]">{formatDateTime(comment.createdAt)}</p>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{comment.contentText}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <form action={createCommentAction} className="mt-4 flex flex-col gap-3">
                        <input name="postId" type="hidden" value={post.id} />
                        <textarea className="lux-textarea min-h-20" name="contentText" placeholder="Reply to this post" required />
                        <div className="flex justify-end">
                          <button className="lux-button-secondary" type="submit">Add comment</button>
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
            <div className="flex items-center justify-between gap-3 border-b lux-divider pb-4">
              <div>
                <p className="lux-overline">Members</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--lux-text)]">Who is here</h2>
              </div>
              <Link className="text-sm font-medium text-[color:var(--lux-text-secondary)] underline-offset-4 hover:underline" href="/groups">
                All groups
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {group.memberships.map((item) => (
                <div key={item.user.id} className="lux-card-soft py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link className="font-medium text-[color:var(--lux-text)]" href={`/users/${item.user.id}`}>
                      {item.user.displayName}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
                        {item.userId === group.createdByUserId ? "Owner" : item.role}
                      </span>
                      {isOwner && item.userId !== group.createdByUserId ? (
                        <form action={removeGroupMemberAction}>
                          <input name="groupId" type="hidden" value={group.id} />
                          <input name="memberUserId" type="hidden" value={item.userId} />
                          <button className="lux-button-danger px-3 py-1.5 text-xs" type="submit">Remove</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {isManager ? (
            <section className="lux-card">
              <div className="border-b lux-divider pb-5">
                <p className="lux-overline">Join requests</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-[color:var(--lux-text)]">Review access requests</h2>
                <p className="lux-body mt-3">Approve or reject members who want access to this space.</p>
              </div>
              <div className="mt-4 space-y-3">
                {group.joinRequests.length === 0 ? (
                  <p className="text-sm text-[color:var(--lux-text-muted)]">No pending join requests.</p>
                ) : (
                  group.joinRequests.map((request) => (
                    <div key={request.id} className="lux-card-soft text-sm">
                      <Link className="font-medium text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={`/users/${request.applicant.id}`}>
                        {request.applicant.displayName}
                      </Link>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{request.requestMessage ?? "No request note."}</p>
                      <div className="mt-4 flex gap-2">
                        <form action={reviewGroupJoinRequestAction}>
                          <input name="joinRequestId" type="hidden" value={request.id} />
                          <input name="decision" type="hidden" value="approve" />
                          <button className="lux-button-primary" type="submit">Approve</button>
                        </form>
                        <form action={reviewGroupJoinRequestAction}>
                          <input name="joinRequestId" type="hidden" value={request.id} />
                          <input name="decision" type="hidden" value="reject" />
                          <button className="lux-button-secondary" type="submit">Reject</button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : (
            <section className="lux-card">
              <p className="lux-overline">Access model</p>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="lux-card-soft">
                  <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Type</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{group.groupType}</p>
                </div>
                <div className="lux-card-soft">
                  <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Posting rules</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Posts in groups are attributed to the member who created them.</p>
                </div>
              </div>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

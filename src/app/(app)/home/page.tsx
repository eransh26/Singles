import Link from "next/link";
import { Search } from "lucide-react";
import { ChatRequestStatus, ConsentStatus, MembershipStatus, PhotoAccessRequestStatus, PlacementType, PostContextType, PostVisibilityStatus } from "@prisma/client";
import { createCommentAction, createPostAction } from "../actions";
import { hasMinimalProfileVisibility, isFullyVerifiedUser, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getPromotedPlacement } from "@/lib/promotions";
import { RelativeTime } from "@/components/relative-time";
import { HomeComposer } from "./home-composer";
import { PostAuthorActions } from "@/components/post-author-actions";
import { PostEngagement } from "@/components/post-engagement";

function userPairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

export default async function HomePage() {
  const viewer = await requireUser();
  const viewerIsVerified = isFullyVerifiedUser(viewer);

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
        author: {
          select: {
            id: true,
            displayName: true,
            profileVisibility: true,
            chatRequestPolicy: true,
            photoRequestPolicy: true,
          },
        },
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
        reactions: {
          where: { userId: viewer.id },
          select: { reactionType: true },
        },
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { moderationStatus: { not: "REMOVED" } },
            },
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

  const actionableAuthorIds = Array.from(
    new Set(
      posts
        .filter((post) => post.authorUserId !== viewer.id)
        .map((post) => post.authorUserId),
    ),
  );
  const pairKeys = actionableAuthorIds.map((authorUserId) => userPairKey(viewer.id, authorUserId));

  const [conversations, chatRequests, photoRequests, videoConsents, photoGrants, blocks] = actionableAuthorIds.length
    ? await Promise.all([
        prisma.conversation.findMany({
          where: { pairKey: { in: pairKeys }, status: "ACTIVE" },
          select: { id: true, pairKey: true },
        }),
        prisma.chatRequest.findMany({
          where: { pairKey: { in: pairKeys }, status: ChatRequestStatus.PENDING },
          orderBy: { createdAt: "desc" },
          select: { id: true, pairKey: true, fromUserId: true, toUserId: true },
        }),
        prisma.photoAccessRequest.findMany({
          where: { pairKey: { in: pairKeys }, status: PhotoAccessRequestStatus.PENDING },
          orderBy: { createdAt: "desc" },
          select: { id: true, pairKey: true, requesterUserId: true },
        }),
        prisma.videoConsent.findMany({
          where: { pairKey: { in: pairKeys } },
          select: { pairKey: true, status: true },
        }),
        prisma.photoAccessGrant.findMany({
          where: { ownerUserId: { in: actionableAuthorIds }, granteeUserId: viewer.id, revokedAt: null },
          select: { ownerUserId: true },
        }),
        prisma.userBlock.findMany({
          where: {
            OR: [
              { blockerUserId: viewer.id, blockedUserId: { in: actionableAuthorIds } },
              { blockerUserId: { in: actionableAuthorIds }, blockedUserId: viewer.id },
            ],
          },
          select: { blockerUserId: true, blockedUserId: true },
        }),
      ])
    : [[], [], [], [], [], []];

  const conversationByPairKey = new Map(conversations.map((conversation) => [conversation.pairKey, conversation]));
  const chatRequestByPairKey = new Map(chatRequests.map((request) => [request.pairKey, request]));
  const photoRequestByPairKey = new Map(photoRequests.map((request) => [request.pairKey, request]));
  const videoConsentByPairKey = new Map(videoConsents.map((consent) => [consent.pairKey, consent]));
  const approvedGalleryOwners = new Set(photoGrants.map((grant) => grant.ownerUserId));
  const blockedUsers = new Set(
    blocks.map((block) => (block.blockerUserId === viewer.id ? block.blockedUserId : block.blockerUserId)),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_320px] lg:items-start">
        <div className="space-y-4">
          <section className="lux-card p-4 shadow-[0_18px_40px_rgba(43,43,43,0.08)] md:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--lux-accent-border)] bg-[color:var(--lux-highlight-soft)] text-sm font-semibold text-[color:var(--lux-accent-deep)]">
                {viewer.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-[color:var(--lux-text)]">{viewer.displayName}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">Community feed</p>
              </div>
            </div>
            <HomeComposer action={createPostAction} />
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
                const pairKey = userPairKey(viewer.id, post.authorUserId);
                const existingConversation = conversationByPairKey.get(pairKey);
                const existingChatRequest = chatRequestByPairKey.get(pairKey);
                const existingPhotoRequest = photoRequestByPairKey.get(pairKey);
                const isBlocked = blockedUsers.has(post.authorUserId);
                const hasApprovedPhotoGrant = approvedGalleryOwners.has(post.authorUserId);
                const chatState = existingConversation
                  ? "open"
                  : existingChatRequest?.toUserId === viewer.id
                    ? "incoming"
                    : existingChatRequest?.fromUserId === viewer.id
                      ? "pending"
                      : isBlocked || !hasMinimalProfileVisibility(post.author.profileVisibility)
                        ? "blocked"
                        : post.author.chatRequestPolicy === "NOBODY"
                          ? "blocked"
                          : post.author.chatRequestPolicy === "VERIFIED_ONLY" && !viewerIsVerified
                            ? "blocked"
                            : "send";
                const photoState = hasApprovedPhotoGrant
                  ? "approved"
                  : existingPhotoRequest?.requesterUserId === viewer.id
                    ? "pending"
                    : isBlocked || post.author.photoRequestPolicy === "NOBODY" || !viewerIsVerified
                      ? "blocked"
                      : "request";
                const videoConsent = videoConsentByPairKey.get(pairKey);
                const videoState = existingConversation
                  ? videoConsent?.status === ConsentStatus.APPROVED
                    ? "approved"
                    : videoConsent?.status === ConsentStatus.PENDING
                      ? "pending"
                      : isBlocked
                        ? "blocked"
                        : "request"
                  : "blocked";

                return (
                  <article key={post.id} className="lux-card p-4 shadow-[0_10px_24px_rgba(43,43,43,0.04)] md:p-5">
                    <div className="flex flex-col gap-4">
                      <div className="group flex items-start justify-between gap-3">
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
                          <RelativeTime className="mt-1 block text-[11px] tracking-normal text-[color:var(--lux-text-muted)]" value={post.createdAt.toISOString()} />
                        </div>
                        <div className="flex items-center gap-2">
                          {canOpenAuthorProfile && post.authorUserId !== viewer.id ? (
                            <PostAuthorActions
                              chatState={chatState}
                              conversationId={existingConversation?.id}
                              photoState={photoState}
                              sourcePath="/home"
                              targetUserId={post.author.id}
                              videoState={videoState}
                            />
                          ) : null}
                          {canOpenAuthorProfile ? (
                            <Link className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)] underline-offset-4 hover:underline" href={authorProfileHref}>
                              {post.authorUserId === viewer.id ? "My profile" : "View profile"}
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--lux-text-secondary)]">{post.contentText}</p>

                      <PostEngagement
                        commentAction={createCommentAction}
                        commentCount={post._count.comments}
                        commentPlaceholder="Write a comment"
                        commentSubmitLabel="Add comment"
                        comments={post.comments.map((comment) => ({
                          ...comment,
                          createdAt: comment.createdAt.toISOString(),
                        }))}
                        groupHref={post.group ? `/groups/${post.group.id}` : undefined}
                        postId={post.id}
                        reactionCount={post._count.reactions}
                        reactionType={post.reactions[0]?.reactionType ?? null}
                        viewerId={viewer.id}
                      />
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="lux-card p-4">
            <p className="lux-overline">Search Evyta</p>
            <form action="/search" className="mt-3">
              <div className="flex items-center gap-2 rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-3 py-2.5">
                <Search className="h-4 w-4 text-[color:var(--lux-text-muted)]" />
                <input className="w-full bg-transparent text-sm text-[color:var(--lux-text)] outline-none placeholder:text-[color:var(--lux-text-muted)]" name="query" placeholder="Members, groups, posts" />
              </div>
            </form>
          </section>

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
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">Identity and media</h2>
              </div>
              <Link className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)] underline-offset-4 hover:underline" href="/me">
                Open
              </Link>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Keep your profile, interests, and media collection curated for the community.</p>
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
                  <Link key={group.id} className="block rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-4 transition hover:border-[color:var(--lux-accent-border)]" href={`/groups/${group.id}`}>
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


import Link from "next/link";
import {
  BuddyRequestStatus,
  ChatRequestStatus,
  ConsentStatus,
  MembershipStatus,
  PhotoAccessRequestStatus,
  PlacementType,
  PostContextType,
  PostVisibilityStatus,
} from "@prisma/client";
import { createCommentAction, createPostAction } from "../actions";
import { sendSingleOfWeekChatRequestAction } from "../single-of-the-week/actions";
import { hasMinimalProfileVisibility, isFullyVerifiedUser, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { canCreateSingleOfWeekRequest, isTrustedSingleOfWeekRequester, syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { getHighRiskAccessState, HIGH_RISK_ACTIONS } from "@/lib/high-risk-access";
import { ensureDefaultFeatureFlags, FEATURE_FLAG_KEYS, getFeatureAvailability } from "@/lib/feature-flags";
import { getPromotedPlacement } from "@/lib/promotions";
import { getUnreadNotificationCounts } from "@/lib/notifications";
import { resolveSingleOfWeekPhotoUrl } from "@/lib/media-display";
import { HomeComposer } from "./home-composer";
import { PostAuthorActions } from "@/components/post-author-actions";
import { SingleOfWeekViewBeacon } from "@/components/single-of-week-view-beacon";
import { HomeBottomNav } from "@/components/home/bottom-nav";
import { HomeFeedCard } from "@/components/home/feed-card";
import { OpportunityRail } from "@/components/home/opportunity-rail";
import { HomeSignalCard } from "@/components/home/signal-card";
import { HomeTopBar } from "@/components/home/top-bar";

function userPairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

export default async function HomePage() {
  const viewer = await requireUser();

  await ensureDefaultFeatureFlags();
  const features = await getFeatureAvailability([FEATURE_FLAG_KEYS.buddy, FEATURE_FLAG_KEYS.singleOfWeek], viewer);
  const buddyEnabled = features[FEATURE_FLAG_KEYS.buddy];
  const singleOfWeekEnabled = features[FEATURE_FLAG_KEYS.singleOfWeek];
  const viewerIsVerified = isFullyVerifiedUser(viewer);

  const [videoTrustAccess, featuredTrustAccess, buddyTrustAccess, notificationCounts] = await Promise.all([
    getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.VIDEO_REQUEST),
    getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.FEATURED_REQUEST),
    getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.BUDDY_ELIGIBILITY),
    getUnreadNotificationCounts(viewer.id),
  ]);

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
    select: { groupId: true, group: { select: { id: true, name: true } } },
    take: 5,
  });

  const visibleGroupIds = memberships.map((membership) => membership.groupId);
  const featuredState = singleOfWeekEnabled ? await syncSingleOfWeekState() : null;

  const [posts, recommendedGroups, promotedPlacement, activeBuddyRequest] = await Promise.all([
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
        sensitivityStatus: true,
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
            trustTier: true,
            trustSummary: true,
            emailVerified: true,
            phoneVerifiedAt: true,
          },
        },
        group: { select: { id: true, name: true } },
        media: { orderBy: { sortOrder: "asc" }, select: { id: true, storageKey: true } },
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
    buddyEnabled
      ? prisma.buddyRequest.findFirst({
          where: {
            seekerId: viewer.id,
            status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] },
          },
          select: { id: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  const featuredMember = featuredState?.status === "ACTIVE" ? featuredState : null;
  const featuredPhotoUrl = featuredMember
    ? featuredMember.application.photos.map((photo) => resolveSingleOfWeekPhotoUrl(photo)).find((value): value is string => Boolean(value)) ?? null
    : null;

  const featuredTrustUser = featuredMember
    ? await prisma.user.findUnique({
        where: { id: featuredMember.featuredUserId },
        select: { trustTier: true, trustSummary: true, emailVerified: true, phoneVerifiedAt: true },
      })
    : null;

  const featuredRequestState = featuredMember
    ? await (async () => {
        const targetUserId = featuredMember.featuredUserId;
        const pairKey = userPairKey(viewer.id, targetUserId);
        const [existingConversation, existingPendingRequest, trustedRequester, capState] = await Promise.all([
          prisma.conversation.findUnique({ where: { pairKey }, select: { id: true, status: true } }),
          prisma.chatRequest.findFirst({
            where: { pairKey, status: ChatRequestStatus.PENDING },
            orderBy: { createdAt: "desc" },
            select: { id: true, fromUserId: true, toUserId: true },
          }),
          viewer.id === targetUserId
            ? Promise.resolve(false)
            : Promise.resolve(featuredTrustAccess.allowed).then((allowed) => allowed && isTrustedSingleOfWeekRequester(prisma, viewer.id, targetUserId)),
          canCreateSingleOfWeekRequest(featuredMember.id, viewer.id),
        ]);

        return { existingConversation, existingPendingRequest, trustedRequester, capState };
      })()
    : null;

  const featuredCalloutMessage = featuredMember
    ? !featuredTrustAccess.allowed
      ? featuredTrustAccess.reason
      : featuredRequestState?.capState.blocked
        ? featuredRequestState.capState.reason
        : !featuredRequestState?.trustedRequester
          ? "Only trusted verified members can send requests to the featured member."
          : "Requests follow the standard trust and approval flow."
    : null;

  const actionableAuthorIds = Array.from(new Set(posts.filter((post) => post.authorUserId !== viewer.id).map((post) => post.authorUserId)));
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
  const blockedUsers = new Set(blocks.map((block) => (block.blockerUserId === viewer.id ? block.blockedUserId : block.blockerUserId)));

  const feedEntries = posts.map((post) => {
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
          : !videoTrustAccess.allowed
            ? "blocked"
            : isBlocked
              ? "blocked"
              : "request"
      : "blocked";

    return {
      post: {
        id: post.id,
        contentText: post.contentText,
        sensitivityStatus: post.sensitivityStatus,
        createdAt: post.createdAt.toISOString(),
        media: post.media,
        group: post.group,
        authorUserId: post.authorUserId,
        authorLabel,
        authorHref: canOpenAuthorProfile ? authorProfileHref : null,
        authorInitial: authorLabel.slice(0, 1).toUpperCase(),
        trustTier: post.author.trustTier,
        trustSummary: post.author.trustSummary,
        emailVerified: Boolean(post.author.emailVerified),
        phoneVerified: Boolean(post.author.phoneVerifiedAt),
        visibilityNote: isAnonymousAuthorView ? "Visible only to you" : null,
        canOpenAuthorProfile,
        comments: post.comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() })),
        reactionCount: post._count.reactions,
        reactionType: post.reactions[0]?.reactionType ?? null,
        commentCount: post._count.comments,
      },
      authorActions:
        canOpenAuthorProfile && post.authorUserId !== viewer.id ? (
          <PostAuthorActions
            chatState={chatState}
            conversationId={existingConversation?.id}
            photoState={photoState}
            sourcePath="/home"
            targetUserId={post.author.id}
            videoState={videoState}
          />
        ) : null,
    };
  });

  return (
    <main className="mx-auto min-h-screen max-w-[1380px] px-3 pb-28 pt-4 md:px-5 md:pb-10 md:pt-5" data-testid="home-page">
      <div className="rounded-[2rem] border border-[rgba(228,213,192,0.05)] bg-[radial-gradient(circle_at_top,rgba(189,151,100,0.06),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(126,89,73,0.06),transparent_22%),linear-gradient(180deg,#2e251f_0%,#231c18_42%,#1c1714_100%)] px-3 py-3 text-white shadow-[0_22px_54px_rgba(18,12,9,0.1)] md:px-5 md:py-5">
        <HomeTopBar notificationCount={notificationCounts.total} viewerInitial={viewer.displayName.slice(0, 1).toUpperCase()} />

        <section className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_340px] lg:items-start">
          <div className="space-y-4" data-testid="home-feed">
            <section className="rounded-[1.75rem] border border-[rgba(228,213,192,0.05)] bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(255,255,255,0.012))] px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(18,12,9,0.08)] md:px-5 md:py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--lux-text-muted)]">Community pulse</p>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[1.75rem] font-medium tracking-tight text-white/90 md:text-[2.2rem]">See the circle, not the noise.</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-[1.65] text-[color:var(--lux-text-secondary)] md:text-[15px]">
                    A discreet place to catch what&apos;s moving through the community, post quickly, and notice the people, signals, and opportunities that matter.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--lux-text-muted)]">
                  <span className="rounded-full border border-[rgba(228,213,192,0.06)] px-3 py-1.5">Feed-first</span>
                  <span className="rounded-full border border-[rgba(228,213,192,0.06)] px-3 py-1.5">Private trust</span>
                  <span className="rounded-full border border-[rgba(228,213,192,0.06)] px-3 py-1.5">Real community</span>
                </div>
              </div>
            </section>

            <HomeComposer action={createPostAction} viewerName={viewer.displayName} />

            <div className="space-y-4" data-testid="home-feed-list">
              {feedEntries.length === 0 ? (
                <div className="rounded-[1.65rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] px-5 py-8 text-sm leading-7 text-white/56">
                  No posts yet. Start the pulse with a quick update above.
                </div>
              ) : (
                feedEntries.map((entry) => (
                  <div key={entry.post.id} className="space-y-4">
                    <HomeFeedCard authorActions={entry.authorActions} commentAction={createCommentAction} post={entry.post} viewerId={viewer.id} />
                  </div>
                ))
              )}
            </div>
          </div>

          <OpportunityRail>
            {featuredMember ? (
              <section className="space-y-4">
                <SingleOfWeekViewBeacon featureId={featuredMember.id} />
                <HomeSignalCard
                  body={featuredMember.application.bio}
                  ctaHref={viewer.id === featuredMember.featuredUserId ? "/single-of-the-week" : `/users/${featuredMember.featuredUserId}`}
                  ctaLabel={viewer.id === featuredMember.featuredUserId ? "Manage feature" : "View profile"}
                  emailVerified={Boolean(featuredTrustUser?.emailVerified)}
                  meta={featuredCalloutMessage}
                  overline="Single of the Week"
                  phoneVerified={Boolean(featuredTrustUser?.phoneVerifiedAt)}
                  title={featuredMember.application.applicant.displayName}
                  tone="featured"
                  trustTier={featuredTrustUser?.trustTier ?? null}
                >
                  {featuredPhotoUrl ? <img alt="Featured member" className="h-48 w-full rounded-[1.25rem] object-cover" src={featuredPhotoUrl} /> : null}
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
                    {featuredMember.application.interests ? <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1.5">{featuredMember.application.interests}</span> : null}
                    {featuredMember.application.hobbies ? <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1.5">{featuredMember.application.hobbies}</span> : null}
                  </div>
                  {viewer.id !== featuredMember.featuredUserId ? (
                    <div className="mt-4">
                      {featuredRequestState?.existingConversation?.status === "ACTIVE" ? (
                        <Link className="inline-flex items-center rounded-full border border-[rgba(229,181,98,0.24)] bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1d7a4]" href={`/chats/${featuredRequestState.existingConversation.id}`}>
                          Open chat
                        </Link>
                      ) : featuredRequestState?.existingPendingRequest ? (
                        <Link className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.14)] px-4 py-2 text-sm font-medium text-white/82" href="/chats">
                          Request pending
                        </Link>
                      ) : featuredRequestState?.trustedRequester && !featuredRequestState.capState.blocked ? (
                        <form action={sendSingleOfWeekChatRequestAction}>
                          <input name="featureId" type="hidden" value={featuredMember.id} />
                          <input name="sourcePath" type="hidden" value="/home" />
                          <button className="inline-flex items-center rounded-full border border-[rgba(229,181,98,0.24)] bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1d7a4]" type="submit">
                            Request chat
                          </button>
                        </form>
                      ) : (
                        <button className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.14)] px-4 py-2 text-sm font-medium text-white/52" disabled type="button">
                          Request chat
                        </button>
                      )}
                    </div>
                  ) : null}
                </HomeSignalCard>
              </section>
            ) : singleOfWeekEnabled ? (
              <HomeSignalCard
                body="Use a dedicated featured-profile snapshot to apply for a quiet weekly spotlight without turning the feed into a marketplace."
                ctaHref="/single-of-the-week"
                ctaLabel="Open feature"
                overline="Single of the Week"
                title="Apply for a weekly feature"
                tone="community"
              />
            ) : null}

            {promotedPlacement ? (
              <div data-testid="home-promoted-event">
                <HomeSignalCard
                  body={promotedPlacement.eventPromotion.description ?? "A curated community plan is live right now."}
                  ctaHref={promotedPlacement.eventPromotion.externalLink}
                  ctaLabel="View event"
                  meta="Featured quietly in the circle"
                  overline="Tonight"
                  title={promotedPlacement.eventPromotion.title}
                  tone="event"
                />
              </div>
            ) : null}

            {buddyEnabled ? (
              <HomeSignalCard
                body="Private peer support for moments where you need someone steady, without scrolling for the right person."
                ctaHref={activeBuddyRequest ? "/buddy" : "/buddy/new"}
                ctaLabel={activeBuddyRequest ? "Open Buddy" : "Start Buddy"}
                meta={!buddyTrustAccess.allowed ? `${buddyTrustAccess.reason} ${buddyTrustAccess.nextStep ?? ""}`.trim() : activeBuddyRequest ? `Current request ${activeBuddyRequest.status}` : "Available when you need a calmer hand."}
                overline="Buddy"
                title="Need help? Get a Buddy"
                tone="buddy"
              />
            ) : null}

            <HomeSignalCard
              body={recommendedGroups.length === 0 ? "You have explored all current groups for now." : recommendedGroups[0].description ?? "A nearby conversation worth noticing."}
              ctaHref={recommendedGroups.length === 0 ? "/groups" : `/groups/${recommendedGroups[0].id}`}
              ctaLabel={recommendedGroups.length === 0 ? "Browse groups" : "Open group"}
              meta={memberships.length > 0 ? `Your spaces: ${memberships.slice(0, 3).map((membership) => membership.group.name).join(" · ")}` : "No active groups yet"}
              overline="Discover"
              title={recommendedGroups.length === 0 ? "Related groups" : recommendedGroups[0].name}
              tone="community"
            >
              {recommendedGroups.length > 1 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {recommendedGroups.slice(1).map((group) => (
                    <Link key={group.id} className="rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/72" href={`/groups/${group.id}`}>
                      {group.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </HomeSignalCard>
          </OpportunityRail>
        </section>

        <section className="mt-4 space-y-4 lg:hidden">
          {featuredMember ? (
            <HomeSignalCard
              body={featuredMember.application.bio}
              ctaHref={viewer.id === featuredMember.featuredUserId ? "/single-of-the-week" : `/users/${featuredMember.featuredUserId}`}
              ctaLabel={viewer.id === featuredMember.featuredUserId ? "Manage feature" : "View profile"}
              emailVerified={Boolean(featuredTrustUser?.emailVerified)}
              meta={viewer.id === featuredMember.featuredUserId ? "Manage your current feature from here." : "Open the feature to check current request availability."}
              overline="Featured now"
              phoneVerified={Boolean(featuredTrustUser?.phoneVerifiedAt)}
              title={featuredMember.application.applicant.displayName}
              tone="featured"
              trustTier={featuredTrustUser?.trustTier ?? null}
            >
              {featuredPhotoUrl ? <img alt="Featured member" className="h-44 w-full rounded-[1.25rem] object-cover" src={featuredPhotoUrl} /> : null}
            </HomeSignalCard>
          ) : singleOfWeekEnabled ? (
            <HomeSignalCard
              body="Use a dedicated featured-profile snapshot to apply for a quiet weekly spotlight without turning the feed into a marketplace."
              ctaHref="/single-of-the-week"
              ctaLabel="Open feature"
              overline="Featured now"
              title="Apply for a weekly feature"
              tone="community"
            />
          ) : null}

          {promotedPlacement ? (
            <HomeSignalCard
              body={promotedPlacement.eventPromotion.description ?? "Something curated for tonight is quietly circulating through the community."}
              ctaHref={promotedPlacement.eventPromotion.externalLink}
              ctaLabel="View event"
              overline="Tonight"
              title={promotedPlacement.eventPromotion.title}
              tone="event"
            />
          ) : null}

          {buddyEnabled ? (
            <HomeSignalCard
              body="Private peer support for moments where you need someone steady, without searching for the right person yourself."
              ctaHref={activeBuddyRequest ? "/buddy" : "/buddy/new"}
              ctaLabel={activeBuddyRequest ? "Open Buddy" : "Start Buddy"}
              meta={!buddyTrustAccess.allowed ? `${buddyTrustAccess.reason} ${buddyTrustAccess.nextStep ?? ""}`.trim() : activeBuddyRequest ? `Current request ${activeBuddyRequest.status}` : "Available when you need a calmer hand."}
              overline="Buddy"
              title="Need help? Get a Buddy"
              tone="buddy"
            />
          ) : null}
        </section>
      </div>

      <HomeBottomNav />
    </main>
  );
}


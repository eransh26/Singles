import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BuddyRequestStatus,
  ChatRequestStatus,
  ConsentStatus,
  ConversationKind,
  ConversationStatus,
  MembershipStatus,
  PhotoAccessRequestStatus,
  PlacementType,
  PostVisibilityStatus,
  ReactionType,
} from "@prisma/client";
import { createCommentAction } from "../../actions";
import { hasMinimalProfileVisibility, isFullyVerifiedUser, requireUser } from "@/lib/auth/guards";
import { getBuddyDomainOptions } from "@/lib/buddy";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultFeatureFlags, FEATURE_FLAG_KEYS, getFeatureAvailability } from "@/lib/feature-flags";
import { getPromotedPlacement } from "@/lib/promotions";
import { syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { PostAuthorActions } from "@/components/post-author-actions";
import { ThreadBuddyHandoff } from "@/components/post-thread/thread-buddy-handoff";
import { PostThreadCard } from "@/components/post-thread/post-thread-card";
import {
  ThreadEventContextPanel,
  ThreadEventParticipationProvider,
} from "@/components/post-thread/thread-event-coordination";
import { ReplyRow } from "@/components/post-thread/reply-row";
import { ThreadActionBar } from "@/components/post-thread/thread-action-bar";
import { ThreadContextPanel } from "@/components/post-thread/thread-context-panel";
import { ThreadReplyComposer } from "@/components/post-thread/thread-reply-composer";
import { ThreadSocialProof } from "@/components/post-thread/thread-social-proof";

function userPairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

function looksEventRelated(value: string) {
  return /event|tonight|tomorrow|join|going|party|gather|meet|dance|drinks|dinner|host/i.test(value);
}

function looksBuddyRelevant(value: string) {
  return /buddy|support|check in|need help|steady|company|talk|listen|overwhelmed|calmer conversation/i.test(value);
}

function getEventTimingLabel(startsAt: Date | null | undefined) {
  if (!startsAt) {
    return "Soon";
  }

  const now = new Date();
  const start = new Date(startsAt);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((startDay - nowDay) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "Tonight";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  return "Upcoming";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function pickBuddyDomain(
  domainOptions: Array<{ value: string; label: string; slug?: string | null }>,
  sourceText: string,
) {
  const lowerText = sourceText.toLowerCase();
  const slugPriority = [
    { slug: "dating-after-divorce", pattern: /dating|divorce/ },
    { slug: "relationship-support", pattern: /relationship|partner|breakup|separated/ },
    { slug: "bdsm-guidance", pattern: /bdsm|kink|dynamic/ },
    { slug: "starting-over", pattern: /starting over|start over|rebuild|again/ },
    { slug: "someone-to-talk-to", pattern: /talk|listen|alone|quiet/ },
    { slug: "emotional-support", pattern: /support|help|steady|overwhelmed|calm/ },
  ];

  for (const candidate of slugPriority) {
    if (candidate.pattern.test(lowerText)) {
      const match = domainOptions.find((option) => option.slug === candidate.slug);
      if (match) {
        return match;
      }
    }
  }

  return domainOptions[0] ?? null;
}

function buildBuddyPrefillHref(domainId: string | null, message: string) {
  const params = new URLSearchParams();
  if (domainId) {
    params.set("domainId", domainId);
  }
  params.set("message", message);
  return `/buddy/new?${params.toString()}`;
}

export default async function PostThreadPage({ params }: { params: Promise<{ postId: string }> }) {
  const viewer = await requireUser();
  const { postId } = await params;
  const viewerIsVerified = isFullyVerifiedUser(viewer);

  await ensureDefaultFeatureFlags();
  const features = await getFeatureAvailability([FEATURE_FLAG_KEYS.buddy, FEATURE_FLAG_KEYS.singleOfWeek], viewer);
  const buddyEnabled = features[FEATURE_FLAG_KEYS.buddy];
  const singleOfWeekEnabled = features[FEATURE_FLAG_KEYS.singleOfWeek];

  const [post, activeBuddyRequest, featuredState] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        contentText: true,
        sensitivityStatus: true,
        createdAt: true,
        visibilityStatus: true,
        authorUserId: true,
        isAnonymous: true,
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
        group: {
          select: {
            id: true,
            name: true,
            status: true,
            createdByUserId: true,
            isSmallPrivateGroup: true,
            memberships: {
              where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
              select: { userId: true },
              take: 1,
            },
          },
        },
        media: { orderBy: { sortOrder: "asc" }, select: { id: true, storageKey: true } },
        comments: {
          where: { moderationStatus: { not: "REMOVED" } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            contentText: true,
            createdAt: true,
            authorUserId: true,
            author: {
              select: {
                id: true,
                displayName: true,
                trustTier: true,
                emailVerified: true,
                phoneVerifiedAt: true,
              },
            },
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
    buddyEnabled
      ? prisma.buddyRequest.findFirst({
          where: {
            seekerId: viewer.id,
            status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] },
          },
          select: { id: true, status: true },
        })
      : Promise.resolve(null),
    singleOfWeekEnabled ? syncSingleOfWeekState() : Promise.resolve(null),
  ]);

  if (!post || post.visibilityStatus !== PostVisibilityStatus.VISIBLE) {
    notFound();
  }

  if (post.group) {
    const isGroupOwner = post.group.createdByUserId === viewer.id;
    const isGroupMember = post.group.memberships.length > 0;
    if (post.group.status !== "ACTIVE" || (!isGroupOwner && !isGroupMember)) {
      notFound();
    }
  }

  const isAnonymousToViewer = post.isAnonymous && post.authorUserId !== viewer.id;
  const isAnonymousAuthorView = post.isAnonymous && post.authorUserId === viewer.id;
  const authorLabel = isAnonymousToViewer ? "Anonymous member" : post.author.displayName;
  const canOpenAuthorProfile = !isAnonymousToViewer;
  const authorHref = post.authorUserId === viewer.id ? "/me" : `/users/${post.author.id}`;

  const authorPairKey = userPairKey(viewer.id, post.authorUserId);
  const [existingConversation, existingChatRequest, existingPhotoRequest, existingVideoConsent, approvedPhotoGrant, pairBlock] = post.authorUserId !== viewer.id
    ? await Promise.all([
        prisma.conversation.findUnique({ where: { pairKey: authorPairKey }, select: { id: true, status: true } }),
        prisma.chatRequest.findFirst({ where: { pairKey: authorPairKey, status: ChatRequestStatus.PENDING }, orderBy: { createdAt: "desc" }, select: { id: true, fromUserId: true, toUserId: true } }),
        prisma.photoAccessRequest.findFirst({ where: { pairKey: authorPairKey, status: PhotoAccessRequestStatus.PENDING }, orderBy: { createdAt: "desc" }, select: { id: true, requesterUserId: true } }),
        prisma.videoConsent.findUnique({ where: { pairKey: authorPairKey }, select: { status: true } }),
        prisma.photoAccessGrant.findFirst({ where: { ownerUserId: post.authorUserId, granteeUserId: viewer.id, revokedAt: null }, select: { id: true } }),
        prisma.userBlock.findFirst({ where: { OR: [{ blockerUserId: viewer.id, blockedUserId: post.authorUserId }, { blockerUserId: post.authorUserId, blockedUserId: viewer.id }] }, select: { id: true } }),
      ])
    : [null, null, null, null, null, null];

  const chatState = post.authorUserId === viewer.id
    ? "blocked"
    : existingConversation
      ? "open"
      : existingChatRequest?.toUserId === viewer.id
        ? "incoming"
        : existingChatRequest?.fromUserId === viewer.id
          ? "pending"
          : pairBlock || !hasMinimalProfileVisibility(post.author.profileVisibility)
            ? "blocked"
            : post.author.chatRequestPolicy === "NOBODY"
              ? "blocked"
              : post.author.chatRequestPolicy === "VERIFIED_ONLY" && !viewerIsVerified
                ? "blocked"
                : "send";

  const photoState = post.authorUserId === viewer.id
    ? "blocked"
    : approvedPhotoGrant
      ? "approved"
      : existingPhotoRequest?.requesterUserId === viewer.id
        ? "pending"
        : pairBlock || post.author.photoRequestPolicy === "NOBODY" || !viewerIsVerified
          ? "blocked"
          : "request";

  const videoState = post.authorUserId === viewer.id
    ? "blocked"
    : existingConversation?.status === "ACTIVE" && existingVideoConsent?.status === ConsentStatus.APPROVED
      ? "approved"
      : existingConversation?.status === "ACTIVE" && existingVideoConsent?.status === ConsentStatus.PENDING
        ? "pending"
        : existingConversation?.status === "ACTIVE" && !pairBlock
          ? "request"
          : "blocked";

  const featuredMember = featuredState?.status === "ACTIVE" && featuredState.featuredUserId === post.authorUserId ? featuredState : null;
  const buddyContextRelevant = buddyEnabled && looksBuddyRelevant([post.contentText, post.group?.name, ...post.comments.map((comment) => comment.contentText)].filter(Boolean).join(" "));
  const revealHref = post.media.length > 0 && post.sensitivityStatus !== "NORMAL" ? `/validation/sensitive-content?postId=${post.id}` : undefined;
  const eventThreadRelevant = looksEventRelated([post.contentText, post.group?.name, post.group ? "trusted room" : ""].filter(Boolean).join(" "));
  const promotedPlacement = eventThreadRelevant
    ? await getPromotedPlacement(post.group ? PlacementType.GROUP_DETAIL_BANNER : PlacementType.HOME_FEED_CARD, post.group?.id)
    : null;

  const shouldHydrateSignals = Boolean(promotedPlacement || buddyContextRelevant);
  const reactionParticipants = shouldHydrateSignals
    ? await prisma.postReaction.findMany({
        where: { postId: post.id },
        select: { userId: true, reactionType: true },
      })
    : [];

  const participantUserIds = Array.from(
    new Set(
      [post.authorUserId, ...post.comments.map((comment) => comment.authorUserId), ...reactionParticipants.map((reaction) => reaction.userId)]
        .filter((userId) => userId !== viewer.id),
    ),
  );

  const [participantProfiles, circleConversations, buddyDomainOptions] = await Promise.all([
    participantUserIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: participantUserIds } },
          select: {
            id: true,
            trustTier: true,
            buddyProfile: { select: { isAvailable: true } },
          },
        })
      : Promise.resolve([]),
    participantUserIds.length > 0
      ? prisma.conversation.findMany({
          where: {
            kind: ConversationKind.MEMBER_CHAT,
            status: ConversationStatus.ACTIVE,
            OR: [
              { userOneId: viewer.id, userTwoId: { in: participantUserIds } },
              { userTwoId: viewer.id, userOneId: { in: participantUserIds } },
            ],
          },
          select: { userOneId: true, userTwoId: true },
        })
      : Promise.resolve([]),
    buddyContextRelevant && !activeBuddyRequest ? getBuddyDomainOptions() : Promise.resolve([]),
  ]);

  const participantProfileMap = new Map(participantProfiles.map((participant) => [participant.id, participant]));
  const connectedParticipantIds = new Set(
    circleConversations.map((conversation) => (conversation.userOneId === viewer.id ? conversation.userTwoId : conversation.userOneId)),
  );

  const highTrustParticipantCount = participantProfiles.filter((participant) => participant.trustTier === "HIGH").length;
  const buddyAvailableParticipantCount = participantProfiles.filter((participant) => participant.buddyProfile?.isAvailable).length;
  const circleInterestedCount = reactionParticipants.filter((reaction) => reaction.reactionType === ReactionType.SUPPORT && connectedParticipantIds.has(reaction.userId)).length;
  const circleGoingCount = reactionParticipants.filter((reaction) => reaction.reactionType === ReactionType.CELEBRATE && connectedParticipantIds.has(reaction.userId)).length;
  const buddyGoingCount = reactionParticipants.filter((reaction) => reaction.reactionType === ReactionType.CELEBRATE && participantProfileMap.get(reaction.userId)?.buddyProfile?.isAvailable).length;

  const sharedSignals: string[] = [];
  if (connectedParticipantIds.size > 0) {
    sharedSignals.push(`${connectedParticipantIds.size} from your circle active here`);
  }
  if (highTrustParticipantCount > 0) {
    sharedSignals.push(`${highTrustParticipantCount} high-trust ${pluralize(highTrustParticipantCount, "member")} active`);
  }

  const eventSignals: string[] = [];
  if (circleGoingCount > 0) {
    eventSignals.push(`${circleGoingCount} from your circle going`);
  } else if (circleInterestedCount > 0) {
    eventSignals.push(`${circleInterestedCount} from your circle interested`);
  }
  if (buddyGoingCount > 0) {
    eventSignals.push(`${buddyGoingCount} buddy-ready ${pluralize(buddyGoingCount, "member")} going`);
  }

  const buddySignals = [...sharedSignals];
  if (buddyAvailableParticipantCount > 0) {
    buddySignals.push(`${buddyAvailableParticipantCount} buddy-ready ${pluralize(buddyAvailableParticipantCount, "member")} active here`);
  }

  const threadSocialSignals = Array.from(new Set(promotedPlacement ? [...sharedSignals, ...eventSignals] : sharedSignals));
  const interestedCount = reactionParticipants.filter((reaction) => reaction.reactionType === ReactionType.SUPPORT).length;
  const goingCount = reactionParticipants.filter((reaction) => reaction.reactionType === ReactionType.CELEBRATE).length;
  const eventReactionType = post.reactions[0]?.reactionType === ReactionType.SUPPORT || post.reactions[0]?.reactionType === ReactionType.CELEBRATE
    ? post.reactions[0].reactionType
    : null;
  const eventPrivacyLabel = post.group?.isSmallPrivateGroup ? "Private" : post.group ? "Area later" : "Trusted circle";
  const eventScopeLabel = post.group ? `Inside ${post.group.name}` : "Shared with your circle";
  const eventStatusNote = post.group?.isSmallPrivateGroup ? "Area unlocks after join" : "Shared inside trusted circle";
  const eventTimingLabel = promotedPlacement ? getEventTimingLabel(promotedPlacement.eventPromotion.startsAt) : null;

  const preferredBuddyDomain = pickBuddyDomain(
    buddyDomainOptions,
    [post.contentText, ...post.comments.map((comment) => comment.contentText)].join(" "),
  );
  const buddyPrefillMessage = `Coming from this thread: ${post.contentText.slice(0, 180)}`;
  const buddyHref = activeBuddyRequest
    ? "/buddy"
    : buildBuddyPrefillHref(preferredBuddyDomain?.value ?? null, buddyPrefillMessage);
  const buddyStatusLabel = activeBuddyRequest?.status === BuddyRequestStatus.ASSIGNED
    ? "Connected"
    : activeBuddyRequest
      ? "Buddy request sent"
      : "Open to connect";
  const buddyBody = activeBuddyRequest?.status === BuddyRequestStatus.ASSIGNED
    ? "A Buddy connection is already active. You can continue it without leaving the thread."
    : activeBuddyRequest
      ? "You already have a Buddy request moving in the background, so the quieter handoff is already in progress."
      : "If this moment needs steadier support, you can hand it off into Buddy without leaving the thread.";
  const buddyActionLabel = activeBuddyRequest ? "Open Buddy" : "Send buddy request";
  const showBuddyHandoff = buddyContextRelevant;

  const threadBody = (
    <main className="mx-auto min-h-screen max-w-3xl px-3 pb-28 pt-4 md:px-5 md:pb-16 md:pt-6" data-testid="post-thread-page">
      <div className="rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top,rgba(97,69,66,0.16),transparent_24%),linear-gradient(180deg,#17181c_0%,#121319_46%,#0f1015_100%)] px-4 py-4 text-white shadow-[0_30px_80px_rgba(7,8,10,0.24)] md:px-6 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Thread</p>
            <h1 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-white md:text-[2.2rem]">Conversation around a moment</h1>
          </div>
          <Link className="text-sm font-medium text-white/72 underline-offset-4 hover:text-white hover:underline" href={post.group ? `/groups/${post.group.id}` : "/home"}>
            {post.group ? "Back to room" : "Back to home"}
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          <PostThreadCard
            authorActions={
              canOpenAuthorProfile && post.authorUserId !== viewer.id ? (
                <PostAuthorActions
                  chatState={chatState}
                  conversationId={existingConversation?.id}
                  photoState={photoState}
                  sourcePath={`/posts/${post.id}`}
                  targetUserId={post.author.id}
                  videoState={videoState}
                />
              ) : null
            }
            post={{
              id: post.id,
              contentText: post.contentText,
              sensitivityStatus: post.sensitivityStatus,
              createdAt: post.createdAt.toISOString(),
              media: post.media,
              group: post.group ? { id: post.group.id, name: post.group.name } : null,
              authorLabel,
              authorHref: canOpenAuthorProfile ? authorHref : null,
              authorInitial: authorLabel.slice(0, 1).toUpperCase(),
              trustTier: post.author.trustTier,
              emailVerified: Boolean(post.author.emailVerified),
              phoneVerified: Boolean(post.author.phoneVerifiedAt),
              trustSummary: post.author.trustSummary,
              visibilityNote: isAnonymousAuthorView ? "Visible only to you" : null,
              commentCount: post._count.comments,
              reactionCount: post._count.reactions,
            }}
          />

          <div className="grid gap-3" data-testid="thread-context-list">
            {post.group ? (
              <ThreadContextPanel
                body="This post lives inside a more focused room, so the people replying here are seeing it in a tighter community context."
                ctaLabel="Open room"
                href={`/groups/${post.group.id}`}
                label="Room context"
                title={post.group.name}
              />
            ) : null}

            {featuredMember ? (
              <ThreadContextPanel
                body={featuredMember.application.bio}
                ctaLabel={viewer.id === featuredMember.featuredUserId ? "Manage feature" : "View featured profile"}
                href={viewer.id === featuredMember.featuredUserId ? "/single-of-the-week" : `/users/${featuredMember.featuredUserId}`}
                label="Featured signal"
                title={`${featuredMember.application.applicant.displayName} is currently featured`}
                tone="featured"
              />
            ) : null}

            {promotedPlacement && eventTimingLabel ? (
              <ThreadEventContextPanel
                body={promotedPlacement.eventPromotion.description ?? "A curated event is attached to this thread right now."}
                href={promotedPlacement.eventPromotion.externalLink}
                privacyLabel={eventPrivacyLabel}
                scopeLabel={eventScopeLabel}
                signals={eventSignals}
                statusNote={eventStatusNote}
                timingLabel={eventTimingLabel}
                title={promotedPlacement.eventPromotion.title}
              />
            ) : null}

            {threadSocialSignals.length > 0 ? (
              <section
                className="rounded-[1.35rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5 text-white"
                data-testid="thread-social-signals"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/44">Social signals</p>
                <div className="mt-3">
                  <ThreadSocialProof signals={threadSocialSignals} />
                </div>
              </section>
            ) : null}

            {post.media.length > 0 && post.sensitivityStatus !== "NORMAL" ? (
              <ThreadContextPanel
                body="This media stays discreet by default. Reveal goes through the existing sensitive-content validation path."
                ctaLabel="Reveal media"
                href={revealHref}
                label="Private media"
                title="Blurred until you choose to continue"
                tone="media"
              />
            ) : null}

            {showBuddyHandoff ? (
              <ThreadBuddyHandoff
                body={buddyBody}
                ctaHref={buddyHref}
                ctaLabel={buddyActionLabel}
                signals={buddySignals}
                statusLabel={buddyStatusLabel}
                title={activeBuddyRequest ? "The quieter support handoff is already moving" : "Open to connect around this thread"}
              />
            ) : null}
          </div>

          <section className="rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 text-white md:p-5" data-testid="thread-replies-section">
            <div className="flex items-end justify-between gap-3 border-b border-[rgba(255,255,255,0.07)] pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Conversation</p>
                <h2 className="mt-2 text-[1.3rem] font-semibold tracking-tight text-white">Replies around this moment</h2>
              </div>
              <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55">
                {post._count.comments} replies
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {post.comments.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-6 text-sm leading-6 text-white/58">
                  No replies yet. Be the first to keep the thread moving.
                </div>
              ) : (
                post.comments.map((comment) => (
                  <ReplyRow
                    key={comment.id}
                    reply={{
                      id: comment.id,
                      contentText: comment.contentText,
                      createdAt: comment.createdAt.toISOString(),
                      authorHref: comment.authorUserId === viewer.id ? "/me" : `/users/${comment.author.id}`,
                      authorLabel: comment.author.displayName,
                      authorInitial: comment.author.displayName.slice(0, 1).toUpperCase(),
                      trustTier: comment.author.trustTier,
                      emailVerified: Boolean(comment.author.emailVerified),
                      phoneVerified: Boolean(comment.author.phoneVerifiedAt),
                    }}
                  />
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 text-white md:p-5" data-testid="thread-reply-composer-section" id="reply-composer">
            <div className="border-b border-[rgba(255,255,255,0.07)] pb-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Reply</p>
              <h2 className="mt-2 text-[1.2rem] font-semibold tracking-tight text-white">Add to the thread</h2>
              <p className="mt-2 text-sm leading-6 text-white/64">Keep it conversational, discreet, and useful to the people already here.</p>
            </div>
            <ThreadReplyComposer
              action={createCommentAction}
              postId={post.id}
              viewerName={viewer.displayName}
            />
          </section>
        </div>
      </div>

      <ThreadActionBar
        buddyHref={showBuddyHandoff ? buddyHref : undefined}
        buddyLabel={activeBuddyRequest ? "Open Buddy" : "Buddy"}
        eventRelated={Boolean(promotedPlacement)}
        groupHref={post.group ? `/groups/${post.group.id}` : undefined}
        groupId={post.group?.id ?? null}
        postId={post.id}
        reactionCount={post._count.reactions}
        reactionType={post.reactions[0]?.reactionType ?? null}
        replyHref="#reply-composer"
        revealHref={revealHref}
      />
    </main>
  );

  if (!promotedPlacement) {
    return threadBody;
  }

  return (
    <ThreadEventParticipationProvider
      groupId={post.group?.id ?? null}
      initialGoingCount={goingCount}
      initialInterestedCount={interestedCount}
      initialReactionType={eventReactionType}
      postId={post.id}
    >
      {threadBody}
    </ThreadEventParticipationProvider>
  );
}

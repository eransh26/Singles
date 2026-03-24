import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChatRequestPolicy,
  ChatRequestStatus,
  ConsentStatus,
  MediaVisibilityLevel,
  MembershipStatus,
  PhotoAccessRequestStatus,
  PhotoRequestPolicy,
  VerificationStatus,
} from "@prisma/client";
import { requestVideoConsentAction, sendChatRequestAction, sendPhotoAccessRequestAction } from "../../actions";
import { hasMinimalProfileVisibility, isFullyVerifiedUser, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getHighRiskAccessState, HIGH_RISK_ACTIONS } from "@/lib/high-risk-access";
import { resolveProfileImageUrl } from "@/lib/media-display";
import { canCreateSingleOfWeekRequest, syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { ContextChips } from "@/components/discovery/context-chips";
import { SectionHeader } from "@/components/discovery/section-header";
import { HomeBottomNav } from "@/components/home/bottom-nav";
import { HomeTopBar } from "@/components/home/top-bar";
import { ProfileActivityCard } from "@/components/profile/profile-activity-card";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";

export const dynamic = "force-dynamic";

const saveMessages: Record<string, string> = {
  "chat-request": "Chat request sent.",
  "photo-request": "Photo access request sent.",
  "video-request": "Video request sent.",
};

function userPairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

function verificationLabel(status: VerificationStatus) {
  if (status === VerificationStatus.APPROVED) {
    return "Verified profile";
  }
  if (status === VerificationStatus.PENDING) {
    return "Verification pending";
  }
  if (status === VerificationStatus.REJECTED) {
    return "Verification rejected";
  }
  return "Profile still private";
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireUser();
  const { userId } = await params;
  const resolvedSearchParams = await searchParams;
  const pairKey = userPairKey(viewer.id, userId);

  const singleOfWeekEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.singleOfWeek, viewer);
  const activeFeaturedState = singleOfWeekEnabled ? await syncSingleOfWeekState() : null;
  const [videoTrustAccess, featuredTrustAccess, notificationCount] = await Promise.all([
    getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.VIDEO_REQUEST),
    getHighRiskAccessState(prisma, viewer.id, HIGH_RISK_ACTIONS.FEATURED_REQUEST),
    prisma.notification.count({ where: { userId: viewer.id, readAt: null } }),
  ]);

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
    select: { groupId: true },
  });
  const visibleGroupIds = memberships.map((membership) => membership.groupId);

  const [user, sharedGroups, existingConversation, existingChatRequest, existingPhotoRequest, existingVideoConsent, photoGrant, existingBlock, recentPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        bio: true,
        region: true,
        image: true,
        profileVisibility: true,
        verificationStatus: true,
        verifiedBadgeVisible: true,
        chatRequestPolicy: true,
        photoRequestPolicy: true,
        trustTier: true,
        trustSummary: true,
        emailVerified: true,
        phoneVerifiedAt: true,
        interests: { select: { interest: { select: { id: true, name: true } } } },
        profileImageAssets: {
          where: { moderationStatus: "APPROVED", hiddenByModeration: false },
          orderBy: { uploadedAt: "desc" },
          take: 1,
          select: { id: true, storageProvider: true },
        },
        media: {
          where: { isActive: true },
          orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }],
          select: {
            id: true,
            mediaType: true,
            storageKey: true,
            visibilityLevel: true,
          },
        },
        buddyProfile: {
          select: { isAvailable: true, intro: true, availabilityLevel: true },
        },
      },
    }),
    prisma.group.findMany({
      where: {
        memberships: {
          some: {
            userId: viewer.id,
            status: MembershipStatus.ACTIVE,
          },
        },
        AND: {
          memberships: {
            some: {
              userId,
              status: MembershipStatus.ACTIVE,
            },
          },
        },
      },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.conversation.findUnique({
      where: { pairKey },
      select: { id: true, status: true },
    }),
    prisma.chatRequest.findFirst({
      where: { pairKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        fromUserId: true,
        toUserId: true,
      },
    }),
    prisma.photoAccessRequest.findFirst({
      where: { pairKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        requesterUserId: true,
      },
    }),
    prisma.videoConsent.findUnique({
      where: { pairKey },
      select: {
        id: true,
        status: true,
        requesterUserId: true,
        targetUserId: true,
      },
    }),
    prisma.photoAccessGrant.findUnique({
      where: { ownerUserId_granteeUserId: { ownerUserId: userId, granteeUserId: viewer.id } },
      select: { id: true, revokedAt: true },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: viewer.id, blockedUserId: userId },
          { blockerUserId: userId, blockedUserId: viewer.id },
        ],
      },
      select: { id: true },
    }),
    prisma.post.findMany({
      where: {
        authorUserId: userId,
        visibilityStatus: "VISIBLE",
        OR: [
          { contextType: "GLOBAL_FEED" },
          { contextType: "GROUP", groupId: { in: visibleGroupIds.length > 0 ? visibleGroupIds : ["__none__"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        contentText: true,
        createdAt: true,
        group: { select: { name: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const isOwner = viewer.id === user.id;
  const canSeeProfile = hasMinimalProfileVisibility(user.profileVisibility, isOwner);
  const fullyVerifiedViewer = isFullyVerifiedUser(viewer);
  const hasApprovedPhotoGrant = Boolean(photoGrant && !photoGrant.revokedAt);
  const visibleMedia = user.media.filter((item) => {
    if (isOwner) {
      return true;
    }
    if (item.visibilityLevel === MediaVisibilityLevel.PUBLIC) {
      return true;
    }
    return item.visibilityLevel === MediaVisibilityLevel.APPROVED && hasApprovedPhotoGrant;
  });
  const approvedProfileImageAsset = user.profileImageAssets[0] ?? null;
  const profileImageUrl = resolveProfileImageUrl({ approvedProfileImageAsset, legacyImage: user.image });
  const profileMedia = visibleMedia.filter((item) => item.mediaType === "PROFILE");
  const galleryMedia = visibleMedia.filter((item) => item.mediaType === "GALLERY");
  const savedMessage = resolvedSearchParams?.saved ? saveMessages[resolvedSearchParams.saved] : null;
  const hasIncomingChatRequest = existingChatRequest?.status === ChatRequestStatus.PENDING && existingChatRequest.toUserId === viewer.id;
  const hasOutgoingChatRequest = existingChatRequest?.status === ChatRequestStatus.PENDING && existingChatRequest.fromUserId === viewer.id;
  const hasActiveConversation = existingConversation?.status === "ACTIVE";
  const hasPendingVideoRequest = existingVideoConsent?.status === ConsentStatus.PENDING;
  const hasApprovedVideoConsent = existingVideoConsent?.status === ConsentStatus.APPROVED;
  const hasPendingPhotoRequest = existingPhotoRequest?.status === PhotoAccessRequestStatus.PENDING && existingPhotoRequest.requesterUserId === viewer.id;
  const isBlocked = Boolean(existingBlock);
  const activeFeatureForProfile = activeFeaturedState?.status === "ACTIVE" && activeFeaturedState.featuredUserId === user.id ? activeFeaturedState : null;
  const featuredCapState = activeFeatureForProfile ? await canCreateSingleOfWeekRequest(activeFeatureForProfile.id, viewer.id) : null;
  const chatBlockedByPolicy = user.chatRequestPolicy === ChatRequestPolicy.NOBODY;
  const chatNeedsVerification = user.chatRequestPolicy === ChatRequestPolicy.VERIFIED_ONLY && !fullyVerifiedViewer;
  const photoBlockedByPolicy = user.photoRequestPolicy === PhotoRequestPolicy.NOBODY;
  const photoNeedsVerification = !fullyVerifiedViewer;

  const summary = user.bio ?? "A quieter identity card inside the community. Enough context to know whether opening feels right.";
  const profileChips = [
    verificationLabel(user.verificationStatus),
    user.region ? user.region : "Region later",
    sharedGroups.length > 0 ? `${sharedGroups.length} shared ${sharedGroups.length === 1 ? "circle" : "circles"}` : "No shared circles yet",
    activeFeatureForProfile ? "Featured now" : user.buddyProfile?.isAvailable ? "Buddy available" : "Private member",
  ];

  const actionPanel = isOwner ? (
    <div className="rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-white/72" data-testid="profile-action-panel">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/44">Your profile</p>
      <p className="mt-2 leading-6">Edit your profile details, gallery, and privacy settings from your own space.</p>
      <div className="mt-4">
        <Link className="inline-flex items-center rounded-full bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1ddb2] transition hover:bg-[rgba(229,181,98,0.2)]" href="/me">
          Edit my profile
        </Link>
      </div>
    </div>
  ) : (
    <section className="space-y-3" data-testid="profile-action-panel">
      <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-white/72">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/44">Chat</p>
        <p className="mt-2 leading-6">
          {!featuredTrustAccess.allowed && activeFeatureForProfile
            ? `${featuredTrustAccess.reason} ${featuredTrustAccess.nextStep ?? ""}`.trim()
            : featuredCapState?.blocked
              ? featuredCapState.reason
              : chatBlockedByPolicy
                ? "This member is not accepting chat requests right now."
                : chatNeedsVerification
                  ? "Only fully verified members can send a chat request here."
                  : "Start with a quiet request and move the conversation privately from there."}
        </p>
        <div className="mt-4">
          {hasActiveConversation && existingConversation ? (
            <Link className="inline-flex rounded-full border border-[rgba(229,181,98,0.24)] bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1d7a4]" href={`/chats/${existingConversation.id}`}>
              Open conversation
            </Link>
          ) : hasIncomingChatRequest ? (
            <Link className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84" href="/chats">
              Review incoming request
            </Link>
          ) : hasOutgoingChatRequest ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84">Chat request pending</span>
          ) : isBlocked || (!featuredTrustAccess.allowed && activeFeatureForProfile) || featuredCapState?.blocked || chatBlockedByPolicy || chatNeedsVerification ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/62">Request unavailable</span>
          ) : (
            <form action={sendChatRequestAction}>
              <input name="targetUserId" type="hidden" value={user.id} />
              <input name="sourcePath" type="hidden" value={`/users/${user.id}`} />
              <button className="rounded-full bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1ddb2] transition hover:bg-[rgba(229,181,98,0.2)]" type="submit">
                Send chat request
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-white/72">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/44">Private gallery</p>
        <p className="mt-2 leading-6">
          {photoBlockedByPolicy
            ? "This member is not accepting gallery requests."
            : photoNeedsVerification
              ? "You need full verification before requesting private gallery access."
              : "Request access to approved media without turning this into a public gallery flow."}
        </p>
        <div className="mt-4">
          {hasApprovedPhotoGrant ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84">Gallery access granted</span>
          ) : hasPendingPhotoRequest ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84">Photo request pending</span>
          ) : isBlocked || photoBlockedByPolicy || photoNeedsVerification ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/62">Request unavailable</span>
          ) : (
            <form action={sendPhotoAccessRequestAction}>
              <input name="ownerUserId" type="hidden" value={user.id} />
              <input name="sourcePath" type="hidden" value={`/users/${user.id}`} />
              <button className="rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84 transition hover:text-white" type="submit">
                Request photo access
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-white/72">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/44">Video</p>
        <p className="mt-2 leading-6">
          {!videoTrustAccess.allowed
            ? `${videoTrustAccess.reason} ${videoTrustAccess.nextStep ?? ""}`.trim()
            : !hasActiveConversation
              ? "Video stays behind an active approved chat first."
              : "Video needs separate approval and can still be revoked at any time."}
        </p>
        <div className="mt-4">
          {hasApprovedVideoConsent && existingConversation ? (
            <Link className="inline-flex rounded-full border border-[rgba(131,181,156,0.22)] bg-[rgba(131,181,156,0.08)] px-4 py-2 text-sm font-medium text-[#d3e7db]" href={`/chats/${existingConversation.id}`}>
              Video approved
            </Link>
          ) : hasPendingVideoRequest ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84">Video request pending</span>
          ) : isBlocked || !hasActiveConversation || !videoTrustAccess.allowed ? (
            <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/62">Video unavailable</span>
          ) : (
            <form action={requestVideoConsentAction}>
              <input name="targetUserId" type="hidden" value={user.id} />
              <input name="sourcePath" type="hidden" value={`/users/${user.id}`} />
              <button className="rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white/84 transition hover:text-white" type="submit">
                Request video approval
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 pb-28 pt-4 md:px-5 md:pb-14 md:pt-6" data-testid="profile-page">
      <HomeTopBar notificationCount={notificationCount} viewerInitial={viewer.displayName.slice(0, 1).toUpperCase()} />

      {savedMessage ? (
        <div className="mt-4 rounded-[1.3rem] border border-[rgba(131,181,156,0.18)] bg-[rgba(131,181,156,0.08)] px-4 py-3 text-sm text-[#d8eadf]">
          {savedMessage}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">Profile</p>
          <p className="mt-2 text-sm text-white/58">Private identity inside the community</p>
        </div>
        <Link className="text-sm font-medium text-white/72 underline-offset-4 hover:text-white hover:underline" href="/search">
          Back to explore
        </Link>
      </div>

      <div className="mt-4 space-y-6">
        <ProfileIdentityCard
          chips={profileChips}
          emailVerified={Boolean(user.emailVerified)}
          imageUrl={profileImageUrl}
          initial={user.displayName.slice(0, 1).toUpperCase()}
          name={user.displayName}
          phoneVerified={Boolean(user.phoneVerifiedAt)}
          summary={summary}
          trustTier={user.trustTier}
        >
          {actionPanel}
        </ProfileIdentityCard>

        {!canSeeProfile ? (
          <section className="rounded-[1.6rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(18,19,24,0.84)] p-5 text-sm leading-7 text-white/66 shadow-[0_18px_42px_rgba(7,8,10,0.2)]">
            This member keeps their profile layered. You need minimal visibility into the profile before the fuller identity and interaction surface opens.
          </section>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
              <section className="space-y-4">
                <SectionHeader
                  description="Context stays concise and confidence-building, not exhaustive."
                  overline="About"
                  title="What this person shares with the community"
                />
                <div className="rounded-[1.6rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(18,19,24,0.84)] p-5 text-white shadow-[0_18px_42px_rgba(7,8,10,0.2)]">
                  <p className="text-sm leading-7 text-white/74">{user.bio ?? "No bio added yet."}</p>
                  <div className="mt-5 space-y-4">
                    <ContextChips
                      chips={[
                        verificationLabel(user.verificationStatus),
                        user.profileVisibility,
                        user.buddyProfile?.isAvailable ? "Buddy available" : "Conversation-led",
                        activeFeatureForProfile ? "Featured now" : "Not featured",
                      ]}
                    />
                    <ContextChips
                      chips={user.interests.length > 0 ? user.interests.map((interest) => interest.interest.name) : ["No interests shared yet"]}
                      testId="profile-interest-chips"
                    />
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <SectionHeader overline="Community context" title="Signals around this profile" />
                <div className="rounded-[1.6rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(18,19,24,0.84)] p-5 text-white shadow-[0_18px_42px_rgba(7,8,10,0.2)]">
                  <div className="space-y-4 text-sm text-white/72">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/44">Trust</p>
                      <p className="mt-2 leading-6">{user.trustSummary ?? "Trust context stays subtle here and helps you decide whether to open."}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/44">Shared circles</p>
                      <div className="mt-3 space-y-2">
                        {sharedGroups.length === 0 ? (
                          <p className="leading-6 text-white/58">No shared groups to show yet.</p>
                        ) : (
                          sharedGroups.map((group) => (
                            <Link key={group.id} className="block rounded-[1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 transition hover:bg-[rgba(255,255,255,0.05)]" href={`/groups/${group.id}`}>
                              {group.name}
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/44">Media access</p>
                      <p className="mt-2 leading-6">{`${profileMedia.length} profile media visible • ${galleryMedia.length} gallery items visible`}</p>
                    </div>
                  </div>
                </div>
              </aside>
            </section>

            <section className="space-y-4" data-testid="profile-activity-section">
              <SectionHeader
                description="Recent posts stay in the same quiet card language as the home feed and thread."
                overline="Recent activity"
                title="Threads this member has opened recently"
              />
              <div className="grid gap-4 lg:grid-cols-3">
                {recentPosts.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-white/58">
                    No recent visible posts yet.
                  </div>
                ) : (
                  recentPosts.map((post) => (
                    <ProfileActivityCard
                      body={post.contentText}
                      countsLabel={`${post._count.comments} replies • ${post._count.reactions} reactions`}
                      createdAt={post.createdAt.toISOString()}
                      emailVerified={Boolean(user.emailVerified)}
                      href={`/posts/${post.id}`}
                      key={post.id}
                      meta={post.group?.name ?? "Community pulse"}
                      phoneVerified={Boolean(user.phoneVerifiedAt)}
                      title="Open thread"
                      trustTier={user.trustTier}
                    />
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <HomeBottomNav />
    </main>
  );
}


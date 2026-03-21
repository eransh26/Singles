import Link from "next/link";
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
import { canCreateSingleOfWeekRequest, syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { resolveProfileImageUrl } from "@/lib/media-display";
import { notFound } from "next/navigation";

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
  return "Not verified";
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

  const [user, sharedGroups, existingConversation, existingChatRequest, existingPhotoRequest, existingVideoConsent, photoGrant, existingBlock] = await Promise.all([
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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6">
      {savedMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {savedMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Member profile</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border bg-muted text-lg font-semibold text-foreground">
              {profileImageUrl ? <img alt={`${user.displayName} profile`} className="h-full w-full object-cover" src={profileImageUrl} /> : user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{user.displayName}</h1>
            {user.verificationStatus === VerificationStatus.APPROVED && user.verifiedBadgeVisible ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Verified</span>
            ) : null}
          </div>
        </div>
        {isOwner ? (
          <Link className="rounded-full border px-3 py-1.5 text-sm" href="/me">
            Edit my profile
          </Link>
        ) : null}
      </div>

      {!canSeeProfile ? (
        <section className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          This member keeps their profile private. You need minimal visibility into the profile before a chat request can be sent.
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold">About</h2>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {verificationLabel(user.verificationStatus)}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <p>{user.bio ?? "No bio added yet."}</p>
                <p className="text-muted-foreground">Region: {user.region ?? "Not shared"}</p>
                <p className="text-muted-foreground">Profile visibility: {user.profileVisibility}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {user.interests.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No interests shared yet.</span>
                ) : (
                  user.interests.map((interest) => (
                    <span key={interest.interest.id} className="rounded-full border px-3 py-1.5 text-xs">
                      {interest.interest.name}
                    </span>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Media</h2>
                {hasApprovedPhotoGrant ? (
                  <span className="rounded-full border px-3 py-1 text-xs font-medium">Private gallery approved</span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">Profile media</h3>
                  <div className="mt-3 space-y-3">
                    {profileMedia.length === 0 ? (
                      <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No visible profile media.</p>
                    ) : (
                      profileMedia.map((item) => (
                        <div key={item.id} className="rounded-2xl border p-4 text-sm">
                          <p className="break-all font-medium">{item.storageKey}</p>
                          <p className="mt-1 text-muted-foreground">Visibility: {item.visibilityLevel}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Gallery</h3>
                  <div className="mt-3 space-y-3">
                    {galleryMedia.length === 0 ? (
                      <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                        {hasApprovedPhotoGrant ? "No approved gallery media yet." : "No visible gallery media."}
                      </p>
                    ) : (
                      galleryMedia.map((item) => (
                        <div key={item.id} className="rounded-2xl border p-4 text-sm">
                          <p className="break-all font-medium">{item.storageKey}</p>
                          <p className="mt-1 text-muted-foreground">Visibility: {item.visibilityLevel}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            {!isOwner ? (
              <section className="rounded-3xl border bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">Contact and access</p>
                <div className="mt-4 space-y-4 text-sm">
                  <div className="rounded-2xl border p-4">
                    <p className="font-medium">Direct chat</p>
                    <p className="mt-1 text-muted-foreground">
                      {featuredCapState?.blocked
                        ? featuredCapState.reason
                        : chatBlockedByPolicy
                          ? "This member is not accepting chat requests right now."
                          : chatNeedsVerification
                            ? "Only fully verified members can send a chat request to this profile."
                            : "You can request a direct conversation from here."}
                    </p>
                    <div className="mt-4">
                      {hasActiveConversation && existingConversation ? (
                        <Link className="inline-flex rounded-full border px-4 py-2 font-medium" href={`/chats/${existingConversation.id}`}>
                          Open conversation
                        </Link>
                      ) : hasIncomingChatRequest ? (
                        <Link className="inline-flex rounded-full border px-4 py-2 font-medium" href="/chats">
                          Review incoming request
                        </Link>
                      ) : hasOutgoingChatRequest ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Chat request pending</span>
                      ) : isBlocked ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Chat unavailable</span>
                      ) : featuredCapState?.blocked ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Request unavailable</span>
                      ) : chatBlockedByPolicy || chatNeedsVerification ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Request unavailable</span>
                      ) : (
                        <form action={sendChatRequestAction}>
                          <input name="targetUserId" type="hidden" value={user.id} />
                          <input name="sourcePath" type="hidden" value={`/users/${user.id}`} />
                          <button className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground" type="submit">
                            Send chat request
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <p className="font-medium">Private gallery access</p>
                    <p className="mt-1 text-muted-foreground">
                      {photoBlockedByPolicy
                        ? "This member is not accepting gallery requests."
                        : photoNeedsVerification
                          ? "You must be fully verified before requesting access to approved gallery media."
                          : "Request access to the member's approved gallery items."}
                    </p>
                    <div className="mt-4">
                      {hasApprovedPhotoGrant ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Gallery access granted</span>
                      ) : hasPendingPhotoRequest ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Photo request pending</span>
                      ) : isBlocked ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Request unavailable</span>
                      ) : photoBlockedByPolicy || photoNeedsVerification ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Request unavailable</span>
                      ) : (
                        <form action={sendPhotoAccessRequestAction}>
                          <input name="ownerUserId" type="hidden" value={user.id} />
                          <input name="sourcePath" type="hidden" value={`/users/${user.id}`} />
                          <button className="rounded-full border px-4 py-2 font-medium" type="submit">
                            Request photo access
                          </button>
                        </form>
                      )}
                    </div>
                  </div>


                  <div className="rounded-2xl border p-4">
                    <p className="font-medium">Private video approval</p>
                    <p className="mt-1 text-muted-foreground">
                      {!hasActiveConversation
                        ? "Video calls require an active approved chat first."
                        : "Video calls require separate approval and can be revoked at any time."}
                    </p>
                    <div className="mt-4">
                      {hasApprovedVideoConsent && existingConversation ? (
                        <Link className="inline-flex rounded-full border px-4 py-2 font-medium text-emerald-700" href={`/chats/${existingConversation.id}`}>
                          Video approved
                        </Link>
                      ) : hasPendingVideoRequest ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium text-amber-700">Video request pending</span>
                      ) : isBlocked || !hasActiveConversation ? (
                        <span className="inline-flex rounded-full border px-4 py-2 font-medium">Video unavailable</span>
                      ) : (
                        <form action={requestVideoConsentAction}>
                          <input name="targetUserId" type="hidden" value={user.id} />
                          <input name="sourcePath" type="hidden" value={`/users/${user.id}`} />
                          <button className="rounded-full border px-4 py-2 font-medium" type="submit">
                            Request video approval
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Shared groups</h2>
              <div className="mt-4 space-y-2">
                {sharedGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shared groups to show yet.</p>
                ) : (
                  sharedGroups.map((group) => (
                    <Link key={group.id} className="block rounded-2xl border px-4 py-3 text-sm" href={`/groups/${group.id}`}>
                      {group.name}
                    </Link>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}













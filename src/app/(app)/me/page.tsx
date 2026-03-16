import Link from "next/link";
import {
  ActivityVisibility,
  ChatRequestPolicy,
  MediaType,
  MembershipStatus,
  PhotoRequestPolicy,
  ProfileVisibility,
  ThemePreference,
  VerificationStatus,
} from "@prisma/client";
import {
  addProfileMediaAction,
  deleteProfileMediaAction,
  reviewPhotoAccessRequestAction,
  submitVerificationRequestAction,
  updatePrivacyAction,
  updateProfileAction,
} from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

const saveMessages: Record<string, string> = {
  media: "Media updated.",
  photoReview: "Photo access request reviewed.",
  "photo-review": "Photo access request reviewed.",
  privacy: "Privacy and theme preferences saved.",
  profile: "Profile saved.",
  verification: "Verification request submitted.",
};

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

function mediaLabel(mediaType: MediaType) {
  return mediaType === MediaType.PROFILE ? "Profile" : "Gallery";
}

function verificationCopy(status: VerificationStatus) {
  if (status === VerificationStatus.APPROVED) {
    return "Your profile is approved. Your verified badge will appear wherever you choose to show it.";
  }
  if (status === VerificationStatus.PENDING) {
    return "Your verification request is pending review. No extra action is needed right now.";
  }
  if (status === VerificationStatus.REJECTED) {
    return "Your last verification request was rejected. You can submit a new request when you are ready.";
  }
  return "You have not submitted a verification request yet.";
}

export default async function MePage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;

  const [user, interests, memberships, pendingPhotoRequests, activePhotoGrants] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewer.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        bio: true,
        region: true,
        ageVerified: true,
        emailVerified: true,
        phoneVerifiedAt: true,
        verificationStatus: true,
        verifiedBadgeVisible: true,
        profileVisibility: true,
        chatRequestPolicy: true,
        photoRequestPolicy: true,
        activityVisibility: true,
        settings: { select: { themePreference: true } },
        interests: { select: { interestId: true } },
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
    prisma.interest.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.groupMembership.findMany({
      where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
      select: { group: { select: { id: true, name: true } } },
      take: 5,
    }),
    prisma.photoAccessRequest.findMany({
      where: { ownerUserId: viewer.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            displayName: true,
            verificationStatus: true,
          },
        },
      },
    }),
    prisma.photoAccessGrant.findMany({
      where: { ownerUserId: viewer.id, revokedAt: null },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        grantedAt: true,
        grantee: { select: { id: true, displayName: true } },
      },
      take: 6,
    }),
  ]);

  if (!user) {
    return null;
  }

  const selectedInterestIds = new Set(user.interests.map((interest) => interest.interestId));
  const profileMedia = user.media.filter((item) => item.mediaType === MediaType.PROFILE);
  const galleryMedia = user.media.filter((item) => item.mediaType === MediaType.GALLERY);
  const savedMessage = resolvedSearchParams?.saved ? saveMessages[resolvedSearchParams.saved] : null;
  const totalMediaCount = profileMedia.length + galleryMedia.length;

  return (
    <main className="lux-shell">
      {savedMessage ? (
        <div className="rounded-[1.25rem] border border-[color:rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] px-4 py-3 text-sm text-[color:var(--lux-success)]">
          {savedMessage}
        </div>
      ) : null}

      <section className="lux-hero">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] xl:items-end">
          <div className="space-y-5">
            <p className="lux-overline">Private member profile</p>
            <div className="space-y-3">
              <h1 className="text-[2.9rem] font-semibold tracking-tight text-[color:var(--lux-text)] md:text-[4rem] md:leading-[0.98]">{user.displayName}</h1>
              <p className="max-w-2xl text-base leading-8 text-[color:var(--lux-text-secondary)]">
                This is your private member identity space. Shape how your presence feels, what trust signals you reveal, and how closely others are allowed in.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="lux-chip lux-chip-accent">{user.verificationStatus}</span>
              <span className="lux-chip">Theme {user.settings?.themePreference ?? ThemePreference.LIGHT}</span>
              <span className="lux-chip">Media {totalMediaCount}</span>
              {user.region ? <span className="lux-chip">{user.region}</span> : null}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="lux-card-soft">
                <p className="lux-overline">Verification</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">{user.verificationStatus}</p>
              </div>
              <div className="lux-card-soft">
                <p className="lux-overline">Groups</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">{memberships.length} active</p>
              </div>
              <div className="lux-card-soft">
                <p className="lux-overline">Visibility</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">{user.profileVisibility}</p>
              </div>
            </div>
          </div>

          <aside className="rounded-[1.9rem] border border-[color:rgba(198,166,107,0.22)] bg-[color:rgba(255,248,242,0.22)] p-5 dark:bg-[color:rgba(42,36,31,0.56)]">
            <p className="lux-overline">Member signature</p>
            <p className="mt-4 text-sm leading-7 text-[color:var(--lux-text-secondary)]">{user.bio?.trim() || "Add a short note about yourself so your profile feels curated, personal, and intentional to the members who can see it."}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="lux-button-secondary" href={`/users/${user.id}`}>Public profile view</Link>
              {memberships.length > 0 ? memberships.slice(0, 2).map((membership) => (
                <Link key={membership.group.id} className="lux-chip" href={`/groups/${membership.group.id}`}>{membership.group.name}</Link>
              )) : null}
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Identity details</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Refine how your profile reads</h2>
          </div>
          <form action={updateProfileAction} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm text-[color:var(--lux-text-secondary)]">
              <span className="font-medium text-[color:var(--lux-text)]">Display name</span>
              <input className="lux-input" defaultValue={user.displayName} name="displayName" required />
            </label>
            <label className="grid gap-2 text-sm text-[color:var(--lux-text-secondary)]">
              <span className="font-medium text-[color:var(--lux-text)]">Short bio</span>
              <textarea className="lux-textarea min-h-40" defaultValue={user.bio ?? ""} maxLength={3000} name="bio" />
              <span className="text-xs text-[color:var(--lux-text-muted)]">Up to 3000 characters.</span>
            </label>
            <label className="grid gap-2 text-sm text-[color:var(--lux-text-secondary)]">
              <span className="font-medium text-[color:var(--lux-text)]">Region</span>
              <input className="lux-input" defaultValue={user.region ?? ""} maxLength={100} name="region" />
              <span className="text-xs text-[color:var(--lux-text-muted)]">Up to 100 characters.</span>
            </label>
            <fieldset className="grid gap-3 text-sm">
              <legend className="font-medium text-[color:var(--lux-text)]">Interests</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {interests.map((interest) => (
                  <label key={interest.id} className="lux-panel flex items-center gap-2.5 text-[color:var(--lux-text-secondary)] transition hover:border-[color:rgba(198,166,107,0.24)]">
                    <input className="size-4 accent-[color:var(--lux-gold)]" defaultChecked={selectedInterestIds.has(interest.id)} name="interestIds" type="checkbox" value={interest.id} />
                    <span>{interest.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end">
              <button className="lux-button-primary" type="submit">Save profile</button>
            </div>
          </form>
        </section>

        <div className="space-y-6">
          <section className="lux-card">
            <div className="border-b lux-divider pb-5">
              <p className="lux-overline">Trust and visibility</p>
              <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Verification and privacy</h2>
            </div>
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="lux-card-soft">
                  <p className="lux-overline">Email</p>
                  <p className="mt-3 text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{user.emailVerified ? "Verified" : "Not verified"}</p>
                </div>
                <div className="lux-card-soft">
                  <p className="lux-overline">Phone</p>
                  <p className="mt-3 text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{user.phoneVerifiedAt ? "Verified" : "Not verified"}</p>
                </div>
                <div className="lux-card-soft">
                  <p className="lux-overline">18+</p>
                  <p className="mt-3 text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{user.ageVerified ? "Verified" : "Not verified"}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[color:rgba(198,166,107,0.22)] bg-[color:rgba(198,166,107,0.08)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Status {user.verificationStatus}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{verificationCopy(user.verificationStatus)}</p>
                  </div>
                  {user.verificationStatus === VerificationStatus.APPROVED ? null : (
                    <form action={submitVerificationRequestAction}>
                      <button className="lux-button-secondary" type="submit">
                        {user.verificationStatus === VerificationStatus.PENDING ? "Refresh status" : "Request verification"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <form action={updatePrivacyAction} className="grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Who can view my profile</span>
                  <select className="lux-select" defaultValue={user.profileVisibility} name="profileVisibility">
                    {Object.values(ProfileVisibility).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Who can send chat requests</span>
                  <select className="lux-select" defaultValue={user.chatRequestPolicy} name="chatRequestPolicy">
                    {Object.values(ChatRequestPolicy).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Photo request policy</span>
                  <select className="lux-select" defaultValue={user.photoRequestPolicy} name="photoRequestPolicy">
                    {Object.values(PhotoRequestPolicy).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Activity visibility</span>
                  <select className="lux-select" defaultValue={user.activityVisibility} name="activityVisibility">
                    {Object.values(ActivityVisibility).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="font-medium text-[color:var(--lux-text)]">Theme preference</span>
                  <select className="lux-select" defaultValue={user.settings?.themePreference ?? ThemePreference.LIGHT} name="themePreference">
                    {Object.values(ThemePreference).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="lux-panel flex items-center gap-3">
                  <input className="size-4 accent-[color:var(--lux-gold)]" defaultChecked={user.verifiedBadgeVisible} name="verifiedBadgeVisible" type="checkbox" />
                  <span>Show my verified badge when approved</span>
                </label>
                <div className="flex justify-end">
                  <button className="lux-button-primary" type="submit">Save privacy</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </section>

      <section className="lux-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b lux-divider pb-5">
          <div className="max-w-2xl">
            <p className="lux-overline">Media collection</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Profile photo and gallery</h2>
            <p className="text-sm leading-7 text-[color:var(--lux-text-secondary)]">Curate the images and private layers that shape how close others can come.</p>
          </div>
          <div className="grid min-w-[180px] gap-2 text-right text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
            <span>Profile items {profileMedia.length}</span>
            <span>Gallery items {galleryMedia.length}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <form action={addProfileMediaAction} className="rounded-[1.8rem] border border-[color:rgba(198,166,107,0.18)] bg-[color:rgba(255,248,242,0.24)] p-5 dark:bg-[color:rgba(42,36,31,0.56)]">
            <div className="grid gap-3 text-sm text-[color:var(--lux-text-secondary)]">
              <div>
                <p className="text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">Add a media record</p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--lux-text-muted)]">Use a URL or storage key and decide who can see it.</p>
              </div>
              <label className="grid gap-2">
                <span className="font-medium text-[color:var(--lux-text)]">Media URL or storage key</span>
                <input className="lux-input" name="storageKey" placeholder="https://... or object key" required />
              </label>
              <label className="grid gap-2">
                <span className="font-medium text-[color:var(--lux-text)]">Type</span>
                <select className="lux-select" defaultValue={MediaType.GALLERY} name="mediaType">
                  <option value={MediaType.PROFILE}>Profile</option>
                  <option value={MediaType.GALLERY}>Gallery</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="font-medium text-[color:var(--lux-text)]">Visibility</span>
                <select className="lux-select" defaultValue="PUBLIC" name="visibilityLevel">
                  <option value="PUBLIC">Public to members</option>
                  <option value="APPROVED">Approved viewers only</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </label>
              <button className="lux-button-secondary" type="submit">Add media</button>
            </div>
          </form>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight text-[color:var(--lux-text)]">Profile media</h3>
              {profileMedia.length === 0 ? (
                <p className="lux-empty">No profile media yet.</p>
              ) : (
                profileMedia.map((item) => (
                  <div key={item.id} className="lux-card-soft text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="lux-overline">{mediaLabel(item.mediaType)}</p>
                        <p className="mt-3 break-all text-sm font-medium text-[color:var(--lux-text)]">{item.storageKey}</p>
                      </div>
                      <span className="lux-chip">{item.visibilityLevel}</span>
                    </div>
                    <form action={deleteProfileMediaAction} className="mt-4">
                      <input name="mediaId" type="hidden" value={item.id} />
                      <button className="lux-button-danger" type="submit">Remove</button>
                    </form>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight text-[color:var(--lux-text)]">Gallery media</h3>
              {galleryMedia.length === 0 ? (
                <p className="lux-empty">No gallery media yet.</p>
              ) : (
                galleryMedia.map((item) => (
                  <div key={item.id} className="lux-card-soft text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="lux-overline">{mediaLabel(item.mediaType)}</p>
                        <p className="mt-3 break-all text-sm font-medium text-[color:var(--lux-text)]">{item.storageKey}</p>
                      </div>
                      <span className="lux-chip">{item.visibilityLevel}</span>
                    </div>
                    <form action={deleteProfileMediaAction} className="mt-4">
                      <input name="mediaId" type="hidden" value={item.id} />
                      <button className="lux-button-danger" type="submit">Remove</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Photo access</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Incoming private gallery requests</h2>
          </div>
          <div className="mt-5 space-y-3">
            {pendingPhotoRequests.length === 0 ? (
              <p className="lux-empty">No pending photo access requests right now.</p>
            ) : (
              pendingPhotoRequests.map((request) => (
                <div key={request.id} className="lux-card-soft text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link className="font-medium text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={`/users/${request.requester.id}`}>
                        {request.requester.displayName}
                      </Link>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">Requested on {formatDateTime(request.createdAt)}</p>
                    </div>
                    <span className="lux-chip">{request.requester.verificationStatus}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <form action={reviewPhotoAccessRequestAction}>
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="decision" type="hidden" value="approve" />
                      <button className="lux-button-primary" type="submit">Approve</button>
                    </form>
                    <form action={reviewPhotoAccessRequestAction}>
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="decision" type="hidden" value="reject" />
                      <button className="lux-button-secondary" type="submit">Reject</button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Approved viewers</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Members with current gallery access</h2>
          </div>
          <div className="mt-5 space-y-3">
            {activePhotoGrants.length === 0 ? (
              <p className="lux-empty">No approved viewers yet.</p>
            ) : (
              activePhotoGrants.map((grant) => (
                <div key={grant.id} className="lux-card-soft text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link className="font-medium text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={`/users/${grant.grantee.id}`}>
                      {grant.grantee.displayName}
                    </Link>
                    <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">Granted {formatDateTime(grant.grantedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

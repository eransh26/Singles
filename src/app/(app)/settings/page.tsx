import Link from "next/link";
import {
  ActivityVisibility,
  ChatRequestPolicy,
  PhotoRequestPolicy,
  ProfileVisibility,
  VerificationStatus,
} from "@prisma/client";
import {
  reviewPhotoAccessRequestAction,
  revokePhotoAccessGrantAction,
  submitVerificationRequestAction,
  updateNotificationPreferencesAction,
  updatePrivacyAction,
} from "../actions";
import { updateBuddyProfileAction } from "../buddy/actions";
import {
  cancelBuddyApplicationAction,
  createBuddyApplicationAction,
  replaceBuddyRecommenderAction,
} from "../buddy/application-actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getWebPushPublicKey } from "@/lib/notifications";
import { PushNotificationSettings } from "@/components/push-notification-settings";
import { BuddyApplicationForm } from "@/components/buddy-application-form";
import { BuddyProfileForm } from "@/components/buddy-profile-form";
import { RelativeTime } from "@/components/relative-time";
import { getBuddyDomainOptions, getEligibleBuddyRecommenders, isBuddyVerifiedUser } from "@/lib/buddy";

const saveMessages: Record<string, string> = {
  privacy: "Privacy preferences saved.",
  verification: "Verification request submitted.",
  photoReview: "Photo access request reviewed.",
  "photo-review": "Photo access request reviewed.",
  "photo-revoked": "Gallery access revoked.",
  buddy: "Buddy profile saved.",
  "buddy-application-submitted": "Buddy application submitted for recommendations.",
  "buddy-application-cancelled": "Buddy application cancelled.",
  "buddy-application-active": "You already have an active Buddy application.",
  "buddy-recommender-replaced": "Replacement recommender requested.",
  notifications: "Notification preferences saved.",
  application: "Single of the Week application saved.",
  response: "Single of the Week response saved.",
  withdrawn: "Single of the Week application withdrawn.",
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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;
  const pushPublicKey = getWebPushPublicKey();

  const [user, pendingPhotoRequests, activePhotoGrants, buddyProfile, pushSubscriptionCount, settings, buddyDomainOptions, activeBuddyApplication, eligibleBuddyRecommenders, rejectedBuddyApplicationDomains, buddyOverrides] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewer.id },
      select: {
        id: true,
        displayName: true,
        ageVerified: true,
        emailVerified: true,
        phoneVerifiedAt: true,
        verificationStatus: true,
        verifiedBadgeVisible: true,
        profileVisibility: true,
        chatRequestPolicy: true,
        photoRequestPolicy: true,
        activityVisibility: true,
      },
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
    prisma.buddyProfile.findUnique({
      where: { userId: viewer.id },
      select: {
        isAvailable: true,
        intro: true,
        availabilityLevel: true,
        domains: { select: { domain: { select: { id: true, name: true } } } },
      },
    }),
    prisma.webPushSubscription.count({ where: { userId: viewer.id } }),
    prisma.userSettings.findUnique({
      where: { userId: viewer.id },
      select: { webPushEnabled: true, emailActivityEnabled: true, silentModeEnabled: true, hideLockScreenTextEnabled: true },
    }),
    getBuddyDomainOptions(),
    prisma.buddyApplication.findFirst({
      where: { applicantUserId: viewer.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        intro: true,
        availabilityLevel: true,
        domains: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            domain: { select: { id: true, name: true } },
            recommendations: {
              where: { replacedAt: null },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                status: true,
                recommenderUserId: true,
                recommender: { select: { displayName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.$transaction((tx) => getEligibleBuddyRecommenders(tx, viewer.id)),
    prisma.buddyApplicationDomain.findMany({
      where: {
        status: "REJECTED",
        application: { applicantUserId: viewer.id },
      },
      select: { domainId: true },
    }),
    prisma.buddyReapplicationOverride.findMany({
      where: { userId: viewer.id, isActive: true },
      select: { domainId: true },
    }),
  ]);

  if (!user) {
    return null;
  }

  const savedMessage = resolvedSearchParams?.saved ? saveMessages[resolvedSearchParams.saved] : null;
  const buddyEligibility = isBuddyVerifiedUser(user);
  const approvedBuddyDomains = buddyProfile?.domains.map((entry) => entry.domain.name) ?? [];
  const rejectedCountsByDomainId = new Map<string, number>();
  for (const entry of rejectedBuddyApplicationDomains) {
    rejectedCountsByDomainId.set(entry.domainId, (rejectedCountsByDomainId.get(entry.domainId) ?? 0) + 1);
  }
  const overrideDomainIds = new Set(buddyOverrides.map((entry) => entry.domainId));
  const blockedApplicationDomainIds = new Set(
    Array.from(rejectedCountsByDomainId.entries())
      .filter(([domainId, count]) => count >= 3 && !overrideDomainIds.has(domainId))
      .map(([domainId]) => domainId),
  );
  const availableBuddyApplicationDomains = buddyDomainOptions.filter((option) => !blockedApplicationDomainIds.has(option.value));
  const blockedBuddyApplicationDomains = buddyDomainOptions.filter((option) => blockedApplicationDomainIds.has(option.value));

  return (
    <main className="lux-shell">
      {savedMessage ? (
        <div className="rounded-[1.25rem] border border-[color:rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] px-4 py-3 text-sm text-[color:var(--lux-success)]">
          {savedMessage}
        </div>
      ) : null}

      <section className="lux-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="lux-overline">Member settings</p>
            <h1 className="lux-title mt-3">Trust, privacy, and how your profile is experienced.</h1>
            <p className="lux-body mt-4">
              Adjust who can reach you, how your verified state appears, and who currently has access to your approved gallery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 text-xs">
            <span className="lux-chip lux-chip-accent">Status {user.verificationStatus}</span>
            <Link className="lux-button-secondary" href="/me">Back to profile</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Verification</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Trust signals and approval state</h2>
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

            <div className="rounded-[1.5rem] border border-[color:rgba(124,74,110,0.16)] bg-[color:var(--lux-highlight-soft)] p-4">
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
          </div>
        </section>

        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Privacy</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Visibility and request settings</h2>
          </div>
          <form action={updatePrivacyAction} className="mt-5 grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
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
            <label className="lux-panel flex items-center gap-3">
              <input className="size-4 accent-[color:var(--lux-accent)]" defaultChecked={user.verifiedBadgeVisible} name="verifiedBadgeVisible" type="checkbox" />
              <span>Show my verified badge when approved</span>
            </label>
            <div className="flex justify-end">
              <button className="lux-button-primary" type="submit">Save settings</button>
            </div>
          </form>
        </section>
      </section>

      <section className="lux-card" id="single-of-week-link">
        <div className="border-b lux-divider pb-5">
          <p className="lux-overline">Single of the Week</p>
          <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Weekly featured member application</h2>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--lux-text-secondary)]">Apply with a dedicated featured-profile snapshot that stays separate from your main profile and goes through manual review before it appears on the home screen.</p>
          <Link className="lux-button-secondary" href="/single-of-the-week">Open application</Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="lux-card" id="buddy-setup">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Buddy</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Offer peer support in the domains you know best</h2>
          </div>

          {!buddyEligibility ? (
            <div className="mt-5 rounded-[1.4rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-highlight-soft)] p-5 text-sm text-[color:var(--lux-text-secondary)]">
              <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Buddy applications require verified contact details</p>
              <p className="mt-2 leading-6">Complete both email and phone verification before you can apply to become a Buddy.</p>
            </div>
          ) : null}

          <BuddyProfileForm
            action={updateBuddyProfileAction}
            approvedDomains={approvedBuddyDomains}
            initialAvailabilityLevel={buddyProfile?.availabilityLevel ?? ""}
            initialIntro={buddyProfile?.intro ?? activeBuddyApplication?.intro ?? ""}
            initialIsAvailable={buddyProfile?.isAvailable ?? false}
          />

          <div className="mt-6 border-t lux-divider pt-6">
            <p className="lux-overline">Buddy application</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Recommendations and admin review</h3>
            {activeBuddyApplication ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.2rem] border border-[color:var(--lux-border)] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Active Buddy application</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Submitted <RelativeTime value={activeBuddyApplication.createdAt.toISOString()} /></p>
                    </div>
                    <form action={cancelBuddyApplicationAction}>
                      <input name="applicationId" type="hidden" value={activeBuddyApplication.id} />
                      <button className="lux-button-secondary" type="submit">Cancel application</button>
                    </form>
                  </div>
                </div>
                {activeBuddyApplication.domains.map((domainEntry) => (
                  <div className="rounded-[1.2rem] border border-[color:var(--lux-border)] bg-white p-4" key={domainEntry.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{domainEntry.domain.name}</p>
                      <span className="lux-chip">{domainEntry.status}</span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[color:var(--lux-text-secondary)]">
                      {domainEntry.recommendations.map((recommendation, index) => (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[color:var(--lux-border-soft)] bg-[color:var(--lux-secondary)] px-3 py-2" key={recommendation.id}>
                          <span>Recommender {index + 1}: {recommendation.recommender.displayName}</span>
                          <span className="lux-chip">{recommendation.status}</span>
                        </div>
                      ))}
                    </div>
                    {domainEntry.status === "REPLACEMENT_NEEDED" ? (
                      <form action={replaceBuddyRecommenderAction} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <input name="applicationDomainId" type="hidden" value={domainEntry.id} />
                        <label className="grid gap-2 text-sm text-[color:var(--lux-text-secondary)]">
                          <span className="font-medium text-[color:var(--lux-text)]">Replace declined recommender</span>
                          <select className="lux-select" name="recommenderUserId" defaultValue="">
                            <option value="">Choose one</option>
                            {eligibleBuddyRecommenders.filter((option) => !domainEntry.recommendations.some((entry) => entry.recommenderUserId === option.id)).map((option) => (
                              <option key={option.id} value={option.id}>{option.displayName}</option>
                            ))}
                          </select>
                        </label>
                        <button className="lux-button-primary" type="submit">Request replacement</button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : buddyEligibility ? (
              <>
                {blockedBuddyApplicationDomains.length > 0 ? (
                  <div className="mt-5 rounded-[1.2rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] p-4 text-sm text-[color:var(--lux-text-secondary)]">
                    <p className="font-medium text-[color:var(--lux-text)]">Some domains need admin approval before you can apply again</p>
                    <p className="mt-2 leading-6">You have reached the application limit for: {blockedBuddyApplicationDomains.map((domain) => domain.label).join(", ")}.</p>
                  </div>
                ) : null}
                <BuddyApplicationForm
                  action={createBuddyApplicationAction}
                  domainOptions={availableBuddyApplicationDomains}
                  recommenderOptions={eligibleBuddyRecommenders}
                />
              </>
            ) : (
              <p className="mt-5 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Finish verification first to start a Buddy application.</p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="lux-card">
            <div className="border-b lux-divider pb-5">
              <p className="lux-overline">Gallery access</p>
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
                    <div className="mt-3 flex justify-end">
                      <form action={revokePhotoAccessGrantAction}>
                        <input name="grantId" type="hidden" value={grant.id} />
                        <button className="lux-button-secondary" type="submit">Revoke access</button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" id="notifications">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Notifications</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Instant alerts and fallback channels</h2>
          </div>
          <div className="mt-5 space-y-4">
            <PushNotificationSettings
              deviceCount={pushSubscriptionCount}
              isEnabled={Boolean(settings?.webPushEnabled && pushSubscriptionCount > 0)}
              publicKey={pushPublicKey}
            />
            <form action={updateNotificationPreferencesAction} className="grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
              <label className="lux-panel flex items-center gap-3">
                <input className="size-4 accent-[color:var(--lux-accent)]" defaultChecked={settings?.emailActivityEnabled ?? true} name="emailActivityEnabled" type="checkbox" />
                <span>Allow important email fallback later for missed activity</span>
              </label>
              <label className="lux-panel flex items-center gap-3">
                <input className="size-4 accent-[color:var(--lux-accent)]" defaultChecked={settings?.silentModeEnabled ?? false} name="silentModeEnabled" type="checkbox" />
                <span>Silent mode for instant alerts</span>
              </label>
              <p className="-mt-2 pl-7 text-xs leading-6 text-[color:var(--lux-text-muted)]">Use lower-urgency push delivery where the browser supports it.</p>
              <label className="lux-panel flex items-center gap-3">
                <input className="size-4 accent-[color:var(--lux-accent)]" defaultChecked={settings?.hideLockScreenTextEnabled ?? false} name="hideLockScreenTextEnabled" type="checkbox" />
                <span>Hide details on lock screen</span>
              </label>
              <p className="-mt-2 pl-7 text-xs leading-6 text-[color:var(--lux-text-muted)]">Keep push copy generic so previews stay discreet on shared or locked devices.</p>
              <p className="text-sm leading-6 text-[color:var(--lux-text-secondary)]">Email fallback is prepared for important missed activity only. Marketing emails remain separate.</p>
              <div className="flex justify-end">
                <button className="lux-button-primary" type="submit">Save notification preferences</button>
              </div>
            </form>
          </div>
        </section>
      </section>

    </main>
  );
}

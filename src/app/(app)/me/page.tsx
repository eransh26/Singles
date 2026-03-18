import Link from "next/link";
import { MediaType, MembershipStatus } from "@prisma/client";
import {
  addProfileMediaAction,
  deleteProfileMediaAction,
  updateProfileAction,
} from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { AvatarOptionPicker } from "@/components/avatar-option-picker";

const saveMessages: Record<string, string> = {
  media: "Media updated.",
  profile: "Profile saved.",
};

function mediaLabel(mediaType: MediaType) {
  return mediaType === MediaType.PROFILE ? "Profile" : "Gallery";
}

export default async function MePage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;

  const [user, interests, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewer.id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        region: true,
        image: true,
        verificationStatus: true,
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
                Shape how your member identity reads, which interests lead the conversation, and how your media collection feels to the people you allow close.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="lux-chip lux-chip-accent">{user.verificationStatus}</span>
              <span className="lux-chip">Media {totalMediaCount}</span>
              {user.region ? <span className="lux-chip">{user.region}</span> : null}
            </div>
          </div>

          <aside className="rounded-[1.9rem] border border-[color:var(--lux-accent-border)] bg-[color:var(--lux-highlight-soft)] p-5">
            <p className="lux-overline">Member signature</p>
            <p className="mt-4 text-sm leading-7 text-[color:var(--lux-text-secondary)]">{user.bio?.trim() || "Add a short note so your presence feels curated, personal, and intentional."}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="lux-button-secondary" href={`/users/${user.id}`}>Public profile view</Link>
              <Link className="lux-chip" href="/settings">Settings</Link>
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
            <AvatarOptionPicker initialValue={user.image} />
            <fieldset className="grid gap-3 text-sm">
              <legend className="font-medium text-[color:var(--lux-text)]">Interests</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {interests.map((interest) => (
                  <label key={interest.id} className="lux-panel flex items-center gap-2.5 text-[color:var(--lux-text-secondary)] transition hover:border-[color:rgba(124,74,110,0.24)]">
                    <input className="size-4 accent-[color:var(--lux-accent)]" defaultChecked={selectedInterestIds.has(interest.id)} name="interestIds" type="checkbox" value={interest.id} />
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

        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Profile media</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Curate what members see first</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="lux-card-soft">
              <p className="lux-overline">Profile items</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">{profileMedia.length}</p>
            </div>
            <div className="lux-card-soft">
              <p className="lux-overline">Gallery items</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">{galleryMedia.length}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[color:var(--lux-text-secondary)]">
            Gallery approvals and visibility preferences now live in <Link className="underline underline-offset-4" href="/settings">Settings</Link>.
          </p>
        </section>
      </section>

      <section className="lux-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b lux-divider pb-5">
          <div className="max-w-2xl">
            <p className="lux-overline">Media collection</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Profile photo and gallery</h2>
            <p className="text-sm leading-7 text-[color:var(--lux-text-secondary)]">Use URLs or storage keys to keep your visible profile and your private gallery up to date.</p>
          </div>
          <div className="grid min-w-[180px] gap-2 text-right text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">
            <span>Profile items {profileMedia.length}</span>
            <span>Gallery items {galleryMedia.length}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <form action={addProfileMediaAction} className="rounded-[1.8rem] border border-[color:var(--lux-accent-border)] bg-[color:var(--lux-highlight-soft)] p-5">
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
    </main>
  );
}

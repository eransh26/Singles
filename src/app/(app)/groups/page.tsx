import Link from "next/link";
import { GroupType, MembershipStatus, PlacementType } from "@prisma/client";
import { createGroupAction, joinGroupAction } from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getPromotedPlacement } from "@/lib/promotions";

export default async function GroupsPage() {
  const viewer = await requireUser();

  const [groups, promotedPlacement] = await Promise.all([
    prisma.group.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        groupType: true,
        isSmallPrivateGroup: true,
        createdByUserId: true,
        _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
        memberships: {
          where: { userId: viewer.id },
          select: { status: true, role: true },
        },
        joinRequests: {
          where: { applicantUserId: viewer.id, status: "PENDING" },
          select: { id: true },
        },
      },
    }),
    getPromotedPlacement(PlacementType.GROUPS_LIST_BANNER),
  ]);

  const joinedCount = groups.filter((group) => group.memberships[0]?.status === MembershipStatus.ACTIVE).length;
  const pendingCount = groups.filter((group) => group.joinRequests.length > 0).length;

  return (
    <main className="lux-shell">
      <section className="lux-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="lux-overline">Groups</p>
            <h1 className="lux-title mt-3">Private spaces with clearer boundaries.</h1>
            <p className="lux-body mt-4">
              Open groups stay easy to enter. Closed and invite-only rooms feel more selective, quieter, and deliberately held.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <span className="lux-chip">Joined {joinedCount}</span>
            <span className="lux-chip">Pending {pendingCount}</span>
            <span className="lux-chip lux-chip-accent">Available {groups.length}</span>
          </div>
        </div>
      </section>

      {promotedPlacement ? (
        <section className="lux-card relative overflow-hidden" data-testid="groups-promoted-event">
          <div className="absolute inset-y-0 left-0 w-1.5 rounded-full bg-[color:var(--lux-taupe)]" />
          <div className="flex flex-col gap-4 pl-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="lux-overline">Promoted event</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">{promotedPlacement.eventPromotion.title}</h2>
              <p className="lux-body mt-3">
                {promotedPlacement.eventPromotion.description ?? "A promoted community event is highlighted in the groups area."}
              </p>
            </div>
            <a className="lux-button-secondary" href={promotedPlacement.eventPromotion.externalLink} rel="noreferrer" target="_blank">
              View promoted event
            </a>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <div>
            <p className="lux-overline">Browse and join</p>
            <h2 className="lux-section-title mt-2">Current groups</h2>
          </div>
          {groups.map((group) => {
            const membership = group.memberships[0];
            const hasPendingRequest = group.joinRequests.length > 0;
            const isOwner = group.createdByUserId === viewer.id;

            return (
              <article key={group.id} className="lux-card">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link className="text-xl font-semibold tracking-tight text-[color:var(--lux-text)] underline-offset-4 hover:underline" href={`/groups/${group.id}`}>
                        {group.name}
                      </Link>
                      <span className="lux-chip">{group.groupType}</span>
                      {group.isSmallPrivateGroup ? <span className="lux-chip lux-chip-muted">Small private</span> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{group.description ?? "No description yet."}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--lux-text-muted)]">
                      <span>{group._count.memberships} active member{group._count.memberships === 1 ? "" : "s"}</span>
                      {isOwner ? <span>You created this group</span> : null}
                    </div>
                  </div>
                  <div className="min-w-[210px]">
                    {isOwner ? (
                      <span className="lux-chip lux-chip-accent">Owner</span>
                    ) : membership?.status === MembershipStatus.ACTIVE ? (
                      <span className="lux-chip">Joined</span>
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
              </article>
            );
          })}
        </div>

        <aside className="space-y-6">
          <section className="lux-card">
            <div className="border-b lux-divider pb-5">
              <p className="lux-overline">Create a group</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Start a more curated room</h2>
              <p className="lux-body mt-3">
                Keep it minimal: name it clearly, define the tone, and choose the right access model.
              </p>
            </div>
            <form action={createGroupAction} className="mt-5 grid gap-3 text-sm text-[color:var(--lux-text-secondary)]">
              <label className="grid gap-2">
                <span className="font-medium text-[color:var(--lux-text)]">Name</span>
                <input className="lux-input" name="name" required />
              </label>
              <label className="grid gap-2">
                <span className="font-medium text-[color:var(--lux-text)]">Description</span>
                <textarea className="lux-textarea min-h-24" name="description" />
              </label>
              <label className="grid gap-2">
                <span className="font-medium text-[color:var(--lux-text)]">Group type</span>
                <select className="lux-select" defaultValue={GroupType.OPEN} name="groupType">
                  {Object.values(GroupType).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="lux-panel flex items-center gap-3">
                <input className="size-4 accent-[color:var(--lux-gold)]" name="isSmallPrivateGroup" type="checkbox" />
                <span>Small private group</span>
              </label>
              <button className="lux-button-primary" type="submit">Create group</button>
            </form>
          </section>

          <section className="lux-card">
            <p className="lux-overline">Access guide</p>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="lux-card-soft">
                <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Open</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Anyone can join immediately.</p>
              </div>
              <div className="lux-card-soft">
                <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Closed</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Users request access and wait for approval.</p>
              </div>
              <div className="lux-card-soft">
                <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Invite only</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Use for the most curated spaces.</p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

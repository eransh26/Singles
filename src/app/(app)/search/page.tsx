import Link from "next/link";
import { MembershipStatus, PostContextType, PostVisibilityStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams?.query ?? "").trim();

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
    select: { groupId: true },
  });
  const visibleGroupIds = memberships.map((membership) => membership.groupId);

  const [members, groups, posts] = query
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            role: "USER",
            displayName: { contains: query, mode: "insensitive" },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, displayName: true, region: true },
        }),
        prisma.group.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, name: true, description: true, groupType: true },
        }),
        prisma.post.findMany({
          where: {
            visibilityStatus: PostVisibilityStatus.VISIBLE,
            contentText: { contains: query, mode: "insensitive" },
            OR: [
              { contextType: PostContextType.GLOBAL_FEED },
              {
                contextType: PostContextType.GROUP,
                groupId: { in: visibleGroupIds.length > 0 ? visibleGroupIds : ["__none__"] },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            contentText: true,
            groupId: true,
            author: { select: { displayName: true } },
            group: { select: { name: true } },
          },
        }),
      ])
    : [[], [], []];

  return (
    <main className="lux-shell">
      <section className="lux-hero">
        <p className="lux-overline">Search Evyta</p>
        <h1 className="lux-title mt-3">Find members, groups, and recent posts.</h1>
        <form action="/search" className="mt-5 max-w-xl">
          <div className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3">
            <input className="w-full bg-transparent text-sm text-[color:var(--lux-text)] outline-none placeholder:text-[color:var(--lux-text-muted)]" defaultValue={query} name="query" placeholder="Search members, groups, posts" />
            <button className="lux-button-primary px-4 py-2" type="submit">Search</button>
          </div>
        </form>
      </section>

      {!query ? (
        <div className="lux-empty">Enter a member, group, or post keyword to search Evyta.</div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-3">
          <section className="lux-card">
            <p className="lux-overline">Members</p>
            <div className="mt-4 space-y-3">
              {members.length === 0 ? <p className="text-sm text-[color:var(--lux-text-muted)]">No matching members.</p> : members.map((member) => (
                <Link key={member.id} className="block rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3" href={`/users/${member.id}`}>
                  <p className="font-semibold text-[color:var(--lux-text)]">{member.displayName}</p>
                  <p className="mt-1 text-sm text-[color:var(--lux-text-muted)]">{member.region ?? "Region not shared"}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="lux-card">
            <p className="lux-overline">Groups</p>
            <div className="mt-4 space-y-3">
              {groups.length === 0 ? <p className="text-sm text-[color:var(--lux-text-muted)]">No matching groups.</p> : groups.map((group) => (
                <Link key={group.id} className="block rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3" href={`/groups/${group.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[color:var(--lux-text)]">{group.name}</p>
                    <span className="lux-chip">{group.groupType}</span>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--lux-text-muted)]">{group.description ?? "No description yet."}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="lux-card">
            <p className="lux-overline">Posts</p>
            <div className="mt-4 space-y-3">
              {posts.length === 0 ? <p className="text-sm text-[color:var(--lux-text-muted)]">No matching posts.</p> : posts.map((post) => (
                <Link key={post.id} className="block rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3" href={post.groupId ? `/groups/${post.groupId}` : "/home"}>
                  <p className="font-semibold text-[color:var(--lux-text)]">{post.author.displayName}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{post.contentText}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">{post.group?.name ?? "Global feed"}</p>
                </Link>
              ))}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

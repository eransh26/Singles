import { prisma } from "@/lib/db/prisma";
import { AdminPageIntro, AdminQuickLink, SavedMessageBanner, getAdminDashboardData } from "../lib";

function healthLabel(count: number, warningAt: number) {
  return count >= warningAt ? "Warning" : "Healthy";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const dashboard = await getAdminDashboardData();

  const [trustCounts, pendingMediaCount, autoHiddenCount, recentChatsStarted, recentAcceptedRequests] = await Promise.all([
    prisma.user.groupBy({
      by: ["trustTier"],
      _count: { trustTier: true },
    }),
    prisma.userProfileImageAsset.count({ where: { moderationStatus: "PENDING_REVIEW" } }).then((count) =>
      prisma.singleOfWeekApplicationPhoto.count({ where: { moderationStatus: "PENDING_REVIEW" } }).then((photoCount) => count + photoCount),
    ),
    prisma.userProfileImageAsset.count({ where: { hiddenByModeration: true } }).then((count) =>
      prisma.singleOfWeekApplicationPhoto.count({ where: { hiddenByModeration: true } }).then((photoCount) => count + photoCount),
    ),
    prisma.conversation.count({
      where: { kind: "MEMBER_CHAT", createdAt: { gte: dashboard.sevenDaysAgo } },
    }),
    prisma.chatRequest.count({
      where: { status: "ACCEPTED", respondedAt: { gte: dashboard.sevenDaysAgo } },
    }),
  ]);

  const trustCountMap = new Map(trustCounts.map((entry) => [entry.trustTier, entry._count.trustTier]));

  return (
    <main className="space-y-6">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Dashboard"
        title="High-level overview"
        description="A lighter overview for platform health, trust distribution, moderation load, and recent engagement. Action-heavy work now starts in the Action Center."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.cards.map((card) => (
          <article key={card.label} className="admin-card">
            <p className="lux-overline text-[#aa9788]">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[#fff4ea]">{card.value}</p>
            <p className="mt-3 text-sm leading-6 text-[#bbaea1]">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="admin-surface p-6">
          <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
            <p className="lux-overline text-[#a99687]">Trust overview</p>
            <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Current trust distribution</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">High</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{trustCountMap.get("HIGH") ?? 0}</p></div>
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">Normal</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{trustCountMap.get("NORMAL") ?? 0}</p></div>
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">Low</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{trustCountMap.get("LOW") ?? 0}</p></div>
          </div>
        </article>

        <article className="admin-surface p-6">
          <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
            <p className="lux-overline text-[#a99687]">Moderation health</p>
            <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Backlog and hidden content</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">Pending media</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{pendingMediaCount}</p></div>
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">Auto-hidden media</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{autoHiddenCount}</p></div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="admin-surface p-6">
          <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
            <p className="lux-overline text-[#a99687]">Engagement overview</p>
            <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Recent activity</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">Chats started (7d)</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{recentChatsStarted}</p></div>
            <div className="admin-card"><p className="lux-overline text-[#aa9788]">Approved requests (7d)</p><p className="mt-3 text-2xl font-semibold text-[#fff4ea]">{recentAcceptedRequests}</p></div>
          </div>
        </article>

        <article className="admin-surface p-6">
          <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
            <p className="lux-overline text-[#a99687]">System health</p>
            <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Operational summary</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm text-[#d7c8bb]">
            <div className="admin-card flex items-center justify-between"><span>Moderation backlog</span><span>{healthLabel(pendingMediaCount, 6)}</span></div>
            <div className="admin-card flex items-center justify-between"><span>Open reports</span><span>{healthLabel(dashboard.openReports, 6)}</span></div>
            <div className="admin-card flex items-center justify-between"><span>Featured pipeline</span><span>{healthLabel(dashboard.pendingFeaturedApplications, 1)}</span></div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AdminQuickLink href="/admin" label="Action Center" hint="Return to the action-first queue and urgent operational work." />
        <AdminQuickLink href="/admin/media" label="Moderation" hint="Open the full media moderation queue." />
        <AdminQuickLink href="/admin/single-of-the-week" label="Featured" hint="Open featured-member review, current feature status, and caps." />
      </section>
    </main>
  );
}

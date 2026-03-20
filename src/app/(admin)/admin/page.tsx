import { AdminPageIntro, AdminQuickLink, SavedMessageBanner, getAdminDashboardData } from "./lib";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const dashboard = await getAdminDashboardData();

  return (
    <main className="space-y-6">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Dashboard"
        title="Admin dashboard"
        description="A quieter command space for moderation, verification, and launch operations, with the highest-signal items kept close at hand."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.cards.map((card, index) => (
          <article
            key={card.label}
            className={`admin-card ${index === 0 ? "xl:col-span-2" : ""}`}
          >
            <p className="lux-overline text-[#aa9788]">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[#fff4ea]">{card.value}</p>
            <p className="mt-3 text-sm leading-6 text-[#bbaea1]">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AdminQuickLink href="/admin/users" label="Users" hint="Review member accounts, moderation state, and test-user labeling." />
        <AdminQuickLink href="/admin/operators" label="Admin Users" hint="Manage operational admin-only accounts separately from members." />
        <AdminQuickLink href="/admin/verifications" label="Verifications" hint="Review pending verification requests and approve or reject them." />
        <AdminQuickLink href="/admin/reports" label="Reports" hint="Resolve open reports and apply the V1 moderation actions." />
        <AdminQuickLink href="/admin/buddy" label="Buddy" hint="Review Buddy applications, recommendation progress, and domain operations." />
        <AdminQuickLink href="/admin/events" label="Events" hint="Create and update promoted events and placements." />
        <AdminQuickLink href="/admin/audit-logs" label="Audit Logs" hint="Review sensitive admin actions and keep the audit trail visible." />
      </section>
    </main>
  );
}

import { signOutAction } from "../../(auth)/actions";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminSidebarCounts } from "./lib";
import { AdminSidebarNav } from "./sidebar-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const counts = await getAdminSidebarCounts();

  const adminNavigation = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users", badge: counts.memberUserCount },
    { href: "/admin/operators", label: "Admin Users", badge: counts.adminUserCount },
    { href: "/admin/verifications", label: "Verifications", badge: counts.pendingVerificationCount },
    { href: "/admin/reports", label: "Reports", badge: counts.openReportCount },
    { href: "/admin/events", label: "Events", badge: counts.activeEventCount },
    { href: "/admin/audit-logs", label: "Audit Logs", badge: counts.auditLogCount },
  ];

  return (
    <div className="admin-shell min-h-screen text-[#f6eee7]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row lg:gap-6 lg:px-4 lg:py-4">
        <aside className="border-b border-[rgba(90,76,66,0.5)] bg-[rgba(18,15,13,0.82)] px-4 py-5 backdrop-blur-xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-80 lg:flex-none lg:rounded-[2rem] lg:border lg:px-5 lg:py-6">
          <div className="flex h-full flex-col gap-6">
            <div className="space-y-4">
              <div>
                <p className="lux-overline text-[#a99687]">Evyta operational shell</p>
                <h1 className="mt-2 text-[2.1rem] font-semibold tracking-tight text-[#fff4ea]">Admin</h1>
                <p className="mt-2 text-sm leading-6 text-[#bbaea1]">
                  A discreet control console for moderation, verification, reporting, and launch operations.
                </p>
              </div>
              <div className="admin-card">
                <p className="lux-overline text-[#998877]">Signed in as</p>
                <p className="mt-3 text-sm font-medium text-[#fff4ea]">{admin.email}</p>
              </div>
            </div>

            <AdminSidebarNav items={adminNavigation} />

            <form action={signOutAction} className="mt-auto">
              <button className="admin-button-secondary w-full" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex-1 px-4 py-6 md:px-6 lg:px-2 lg:py-2">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}

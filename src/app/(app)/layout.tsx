import Link from "next/link";
import { requireMemberUser } from "@/lib/auth/guards";
import { getUnreadNotificationCounts } from "@/lib/notifications";
import { MemberHeaderActions } from "./member-header-actions";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { NotificationActivityClient } from "@/components/notification-activity-client";
import { ensureDefaultFeatureFlags } from "@/lib/feature-flags";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireMemberUser();
  await ensureDefaultFeatureFlags();
  const counts = await getUnreadNotificationCounts(viewer.id);

  return (
    <div className="ev-app-frame relative flex min-h-screen flex-col text-[color:var(--ev-text)]" data-testid="member-shell">
      <NotificationActivityClient />
      <header
        className="fixed left-1/2 top-0 z-40 w-full max-w-[var(--ev-app-width)] -translate-x-1/2 border-b border-[color:var(--ev-line)] bg-[color:var(--ev-bg-0)]/85 backdrop-blur-xl"
        data-testid="member-shell-header"
      >
        <div className="flex h-[3.55rem] items-center justify-between gap-3 px-4">
          <Link
            aria-label="Evyta home"
            className="ev-display text-[1.55rem] font-medium tracking-tight text-[color:var(--ev-text)]"
            href="/home"
          >
            Evyta
          </Link>
          <MemberHeaderActions notificationCount={counts.total} viewerInitial={viewer.displayName.slice(0, 1).toUpperCase()} />
        </div>
      </header>

      <div className="flex-1 pt-[var(--member-shell-top-offset)] pb-[var(--member-shell-bottom-offset)] md:pt-[var(--member-shell-top-offset-md)]">{children}</div>

      <footer className="flex justify-center gap-4 px-4 pb-[calc(var(--member-shell-bottom-offset)+0.25rem)] pt-3 text-[11px] uppercase tracking-[0.14em] text-[color:var(--ev-text-3)]">
        <Link className="hover:text-[color:var(--ev-text)]" href="/privacy">Privacy</Link>
        <Link className="hover:text-[color:var(--ev-text)]" href="/terms">Terms</Link>
      </footer>

      <MobileBottomNav />
    </div>
  );
}

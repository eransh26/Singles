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
    <div className="ev-member-shell text-[color:var(--ev-text)]" data-testid="member-shell">
      <NotificationActivityClient />

      <header className="flex-none border-b border-[color:var(--ev-line)] bg-[color:var(--ev-bg-0)]/85 backdrop-blur-xl" data-testid="member-shell-header">
        <div className="flex h-[3.55rem] items-center justify-between gap-3 px-4">
          <Link
            aria-label="Evyta home"
            className="ev-display shrink-0 text-[1.5rem] font-medium tracking-tight text-[color:var(--ev-text)]"
            href="/home"
          >
            Evyta
          </Link>
          <MemberHeaderActions notificationCount={counts.total} viewerInitial={viewer.displayName.slice(0, 1).toUpperCase()} />
        </div>
      </header>

      <div className="ev-member-scroll" data-testid="member-scroll">
        {children}
        <footer className="flex justify-center gap-4 px-4 pb-6 pt-4 text-[11px] uppercase tracking-[0.14em] text-[color:var(--ev-text-3)]">
          <Link className="hover:text-[color:var(--ev-text)]" href="/privacy">Privacy</Link>
          <Link className="hover:text-[color:var(--ev-text)]" href="/terms">Terms</Link>
        </footer>
      </div>

      <MobileBottomNav />
    </div>
  );
}

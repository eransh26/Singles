import Image from "next/image";
import Link from "next/link";
import { requireMemberUser } from "@/lib/auth/guards";
import { getUnreadNotificationCounts } from "@/lib/notifications";
import { MemberNav } from "./member-nav";
import { MemberHeaderActions } from "./member-header-actions";
import { MemberHeaderFrame } from "./member-header-frame";
import { NotificationActivityClient } from "@/components/notification-activity-client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireMemberUser();
  const counts = await getUnreadNotificationCounts(viewer.id);

  const navigation = [
    { href: "/home", label: "Home", icon: "home" as const },
    { href: "/groups", label: "Groups", icon: "groups" as const },
    { href: "/chats", label: "Chats", icon: "chats" as const, badgeCount: counts.chats },
    { href: "/buddy", label: "Buddy", icon: "buddy" as const, badgeCount: counts.buddy },
    { href: "/notifications", label: "Notifications", icon: "notifications" as const, badgeCount: counts.total },
    { href: "/me", label: "Profile", icon: "profile" as const },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pt-[4.9rem] md:pt-[5rem]">
      <NotificationActivityClient />
      <MemberHeaderFrame>
        <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--lux-border)] bg-[rgba(250,247,248,0.97)] text-[color:var(--lux-text)] shadow-[0_6px_18px_rgba(43,43,43,0.04)] backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="member-header-bar flex min-h-[4.85rem] items-center gap-4 whitespace-nowrap md:gap-6">
              <div className="flex min-w-[160px] flex-none items-center">
                <div className="flex flex-col gap-0.5">
                  <div className="member-header-logo w-[134px] sm:w-[148px]">
                    <Image alt="Evyta" className="h-auto w-full object-contain" height={56} priority src="/brand/evyta-logo.svg" unoptimized width={240} />
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--lux-text-muted)]">Private Circle</p>
                </div>
              </div>

              <div className="member-header-nav flex min-w-0 flex-1 justify-center overflow-hidden">
                <MemberNav items={navigation} />
              </div>

              <div className="flex min-w-[128px] flex-none items-center justify-end">
                <MemberHeaderActions />
              </div>
            </div>
          </div>
        </header>
      </MemberHeaderFrame>
      <div className="flex-1">{children}</div>
      <footer className="mx-auto flex w-full max-w-6xl justify-end px-4 pb-6 pt-2 md:px-6 md:pb-8">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]">
          <Link className="hover:text-[color:var(--lux-accent-deep)]" href="/privacy">Privacy</Link>
          <Link className="hover:text-[color:var(--lux-accent-deep)]" href="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

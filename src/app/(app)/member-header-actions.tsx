"use client";

import Link from "next/link";
import { Bell, LogOut, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { signOutAction } from "../(auth)/actions";

const ICON_BUTTON =
  "relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[color:var(--ev-line)] text-[color:var(--ev-text-2)] transition hover:border-[color:var(--ev-line-2)] hover:text-[color:var(--ev-text)]";

export function MemberHeaderActions({
  notificationCount = 0,
  viewerInitial = "",
}: {
  notificationCount?: number;
  viewerInitial?: string;
}) {
  const pathname = usePathname() ?? "";
  const isSettings = pathname.startsWith("/settings");

  return (
    <div className="flex items-center gap-2">
      <Link aria-label="Notifications" className={ICON_BUTTON} href="/notifications" title="Notifications">
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
        {notificationCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.05rem] items-center justify-center rounded-full bg-[color:var(--ev-gold)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--ev-on-gold)]">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        ) : null}
      </Link>

      <Link
        aria-label="Settings"
        className={
          isSettings
            ? "inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[color:var(--ev-gold)] bg-[color:var(--ev-gold-bg)] text-[color:var(--ev-gold-text)]"
            : ICON_BUTTON
        }
        href="/settings"
        title="Settings"
      >
        <Settings className="h-[18px] w-[18px]" strokeWidth={1.6} />
      </Link>

      <form action={signOutAction}>
        <button aria-label="Sign out" className={ICON_BUTTON} title="Sign out" type="submit">
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </button>
      </form>

      <Link
        aria-label="Profile"
        className="inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-full border border-[color:var(--ev-line-2)] bg-[color:var(--ev-surface)] px-2 text-sm font-semibold text-[color:var(--ev-text)]"
        href="/me"
      >
        {viewerInitial || <span className="sr-only">Profile</span>}
      </Link>
    </div>
  );
}

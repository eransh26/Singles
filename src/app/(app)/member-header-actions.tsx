"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { signOutAction } from "../(auth)/actions";

export function MemberHeaderActions() {
  const pathname = usePathname() ?? "";
  const isSettings = pathname.startsWith("/settings");

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        aria-label="Settings"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
          isSettings
            ? "border-[color:var(--lux-accent)] bg-[color:var(--lux-highlight-soft)] text-[color:var(--lux-accent-deep)]"
            : "border-[color:transparent] text-[color:var(--lux-text-secondary)] hover:border-[color:var(--lux-border)] hover:text-[color:var(--lux-accent-deep)]"
        }`}
        href="/settings"
        title="Settings"
      >
        <Settings className="h-[18px] w-[18px]" />
      </Link>

      <form action={signOutAction}>
        <button className="member-header-signout inline-flex items-center gap-2 px-1 py-2 text-sm font-medium text-[color:var(--lux-text-secondary)] transition hover:text-[color:var(--lux-accent-deep)]" type="submit">
          <LogOut className="h-[18px] w-[18px]" />
          <span>Sign out</span>
        </button>
      </form>
    </div>
  );
}


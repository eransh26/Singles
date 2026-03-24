import Link from "next/link";
import { Bell, Search, UserRound } from "lucide-react";

type HomeTopBarProps = {
  notificationCount: number;
  viewerInitial: string;
};

export function HomeTopBar({ notificationCount, viewerInitial }: HomeTopBarProps) {
  return (
    <section
      className="sticky top-[5.1rem] z-20 rounded-[1.45rem] border border-transparent bg-[rgba(41,32,27,0.52)] px-4 py-3 text-white shadow-[0_10px_22px_rgba(18,12,9,0.08)] backdrop-blur-xl md:top-[5.5rem]"
      data-testid="home-top-bar"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">Evyta</p>
          <p className="mt-1 text-sm font-medium tracking-[0.02em] text-white/86">Private community pulse</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            aria-label="Search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.02)] text-white/58 transition hover:bg-[rgba(255,255,255,0.05)]"
            href="/search"
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            aria-label="Notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.02)] text-white/58 transition hover:bg-[rgba(255,255,255,0.05)]"
            href="/notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[rgba(189,151,100,0.88)] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f1814]">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </Link>
          <Link
            aria-label="Profile"
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.025)] px-3 text-sm font-semibold text-white/78 transition hover:bg-[rgba(255,255,255,0.055)]"
            href="/me"
          >
            <span className="sr-only">Profile</span>
            <span className="hidden sm:inline">{viewerInitial}</span>
            <UserRound className="h-4 w-4 sm:hidden" />
          </Link>
        </div>
      </div>
    </section>
  );
}

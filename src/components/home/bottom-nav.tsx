import Link from "next/link";
import { Compass, Home, UserRound } from "lucide-react";

export function HomeBottomNav() {
  return (
    <nav
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(18,19,24,0.88)] px-3 py-2 text-white shadow-[0_18px_38px_rgba(7,8,10,0.34)] backdrop-blur md:hidden"
      data-testid="home-bottom-nav"
    >
      <div className="grid grid-cols-3 gap-2">
        <Link className="flex flex-col items-center gap-1 rounded-[1rem] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/84" href="/home">
          <Home className="h-4 w-4" />
          <span>Feed</span>
        </Link>
        <Link className="flex flex-col items-center gap-1 rounded-[1rem] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/64" href="/search">
          <Compass className="h-4 w-4" />
          <span>Explore</span>
        </Link>
        <Link className="flex flex-col items-center gap-1 rounded-[1rem] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/64" href="/me">
          <UserRound className="h-4 w-4" />
          <span>You</span>
        </Link>
      </div>
    </nav>
  );
}

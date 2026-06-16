"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Compass, House, MessagesSquare, Plus, UserRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

type NavTabConfig = {
  href: string;
  label: string;
  icon: typeof House;
  isActive: (pathname: string) => boolean;
};

const HOME: NavTabConfig = { href: "/home", label: "Home", icon: House, isActive: (p) => p === "/home" };
const EXPLORE: NavTabConfig = { href: "/search", label: "Explore", icon: Compass, isActive: (p) => p.startsWith("/search") };
const CHATS: NavTabConfig = { href: "/chats", label: "Chats", icon: MessagesSquare, isActive: (p) => p.startsWith("/chats") };
const YOU: NavTabConfig = { href: "/me", label: "You", icon: UserRound, isActive: (p) => p.startsWith("/me") };

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--lux-border)] bg-[rgba(29,23,20,0.92)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        data-testid="home-bottom-nav"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
          <NavTab tab={HOME} active={HOME.isActive(pathname)} />
          <NavTab tab={EXPLORE} active={EXPLORE.isActive(pathname)} />
          <div className="flex justify-center">
            <button
              aria-label="Create"
              className="inline-flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full border border-transparent bg-[linear-gradient(180deg,#f0d59c_0%,#d6b06a_100%)] text-[color:var(--lux-cta-text)] shadow-[0_10px_24px_rgba(18,12,9,0.4)] transition hover:-translate-y-[0.85rem]"
              onClick={() => setComposerOpen(true)}
              type="button"
            >
              <Plus className="h-6 w-6" strokeWidth={2.2} />
            </button>
          </div>
          <NavTab tab={CHATS} active={CHATS.isActive(pathname)} />
          <NavTab tab={YOU} active={YOU.isActive(pathname)} />
        </div>
      </nav>

      <BottomSheet
        data-testid="composer-sheet"
        description="The full composer arrives in an upcoming update."
        onClose={() => setComposerOpen(false)}
        open={composerOpen}
        title="Share with the circle"
      >
        <div className="rounded-[1.2rem] border border-dashed border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.02)] px-4 py-6 text-sm leading-6 text-[color:var(--lux-text-muted)]">
          Composer preview — posting is not enabled here yet.
        </div>
      </BottomSheet>
    </>
  );
}

function NavTab({ tab, active }: { tab: NavTabConfig; active: boolean }) {
  const Icon = tab.icon;

  return (
    <Link
      className={cn(
        "flex flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-[10px] font-medium uppercase tracking-[0.16em] transition",
        active
          ? "text-[color:var(--lux-accent-deep)]"
          : "text-[color:var(--lux-text-secondary)] hover:text-[color:var(--lux-text)]",
      )}
      href={tab.href}
    >
      <Icon className="h-[20px] w-[20px]" strokeWidth={1.9} />
      <span>{tab.label}</span>
    </Link>
  );
}

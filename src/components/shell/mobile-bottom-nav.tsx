"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Compass, House, MessagesSquare, Plus, UserRound } from "lucide-react";
import { createPostAction } from "@/app/(app)/actions";
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

const INTENTIONS = ["Open to talk", "Looking for plans", "Quiet today", "New here"];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const [composerOpen, setComposerOpen] = useState(false);
  const [intention, setIntention] = useState<string | null>(null);

  return (
    <>
      <nav className="ev-bottomnav z-40 flex-none" data-testid="home-bottom-nav">
        <div className="grid grid-cols-5 place-items-center px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          <NavTab tab={HOME} active={HOME.isActive(pathname)} />
          <NavTab tab={EXPLORE} active={EXPLORE.isActive(pathname)} />
          <button aria-label="Create" className="ev-fab" onClick={() => setComposerOpen(true)} type="button">
            <Plus className="h-6 w-6" strokeWidth={2} />
          </button>
          <NavTab tab={CHATS} active={CHATS.isActive(pathname)} />
          <NavTab tab={YOU} active={YOU.isActive(pathname)} />
        </div>
      </nav>

      <BottomSheet
        data-testid="composer-sheet"
        onClose={() => setComposerOpen(false)}
        open={composerOpen}
        title="Share a signal"
      >
        <form action={createPostAction} className="space-y-4">
          <input name="sourcePath" type="hidden" value="/home" />
          <input name="intention" type="hidden" value={intention ?? ""} />
          <textarea
            className="ev-textarea"
            name="contentText"
            placeholder="What's present for you right now?"
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            {INTENTIONS.map((label) => (
              <button
                className={cn("ev-chip", intention === label && "ev-chip-on")}
                key={label}
                onClick={() => setIntention((current) => (current === label ? null : label))}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="ev-label">Trusted members</span>
            <button className="ev-btn-primary px-6" type="submit">Share</button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}

function NavTab({ tab, active }: { tab: NavTabConfig; active: boolean }) {
  const Icon = tab.icon;

  return (
    <Link className={cn("ev-navitem w-full min-w-0", active && "ev-navitem-active")} href={tab.href}>
      <Icon className="h-[22px] w-[22px] flex-none" strokeWidth={active ? 2 : 1.6} />
      <span className="w-full truncate text-center">{tab.label}</span>
    </Link>
  );
}

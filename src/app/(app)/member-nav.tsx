"use client";

import Link from "next/link";
import { Bell, House, LifeBuoy, MessagesSquare, UserRound, Users } from "lucide-react";
import { usePathname } from "next/navigation";

type MemberNavItem = {
  href: string;
  label: string;
  icon?: "home" | "groups" | "chats" | "buddy" | "notifications" | "profile";
};

const ICONS = {
  home: House,
  groups: Users,
  chats: MessagesSquare,
  buddy: LifeBuoy,
  notifications: Bell,
  profile: UserRound,
} as const;

export function MemberNav({ items }: { items: MemberNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-6 overflow-x-auto text-sm md:gap-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const isActive = item.href === "/home" ? pathname === "/home" : pathname.startsWith(item.href);
        const Icon = item.icon ? ICONS[item.icon] : null;

        return (
          <Link
            aria-label={item.label}
            key={item.href}
            className={`relative inline-flex shrink-0 items-center gap-2 py-2 text-[12px] font-medium uppercase tracking-[0.14em] transition ${
              isActive
                ? "text-[color:var(--lux-accent-deep)]"
                : "text-[color:var(--lux-text-secondary)] hover:text-[color:var(--lux-text)]"
            }`}
            href={item.href}
            title={item.label}
          >
            {Icon ? <Icon className="h-5 w-5" /> : null}
            {item.icon ? <span className="sr-only">{item.label}</span> : item.label}
            <span
              className={`absolute inset-x-0 -bottom-[0.2rem] h-px rounded-full transition ${
                isActive ? "bg-[color:var(--lux-accent)] opacity-100" : "bg-[color:var(--lux-accent)] opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

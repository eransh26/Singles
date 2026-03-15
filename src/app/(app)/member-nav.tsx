"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MemberNavItem = {
  href: string;
  label: string;
};

export function MemberNav({ items }: { items: MemberNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-wrap gap-2.5 text-sm">
      {items.map((item) => {
        const isActive = item.href === "/home" ? pathname === "/home" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            className={`member-nav-link ${isActive ? "member-nav-link-active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

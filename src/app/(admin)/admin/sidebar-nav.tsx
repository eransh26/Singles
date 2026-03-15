"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = {
  href: string;
  label: string;
  badge?: number;
};

function navTestId(label: string) {
  return `admin-sidebar-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function AdminSidebarNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="grid gap-2.5" data-testid="admin-sidebar-nav">
      {items.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            className={`admin-sidebar-link ${isActive ? "admin-sidebar-link-active" : ""}`}
            data-testid={navTestId(item.label)}
            href={item.href}
          >
            <span className="font-medium tracking-[0.01em]">{item.label}</span>
            {typeof item.badge === "number" ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  isActive ? "bg-[rgba(255,248,242,0.14)] text-[#fff4ea]" : "bg-[rgba(255,248,242,0.08)] text-[#d7c8bb]"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

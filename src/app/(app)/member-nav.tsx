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
    <nav className="flex items-center gap-1.5 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const isActive = item.href === "/home" ? pathname === "/home" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            className={`group relative inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-[12px] font-medium uppercase tracking-[0.14em] transition md:px-4 ${
              isActive
                ? "border border-[rgba(201,167,110,0.24)] bg-[linear-gradient(180deg,rgba(201,167,110,0.15),rgba(201,167,110,0.06))] text-[#fff4ea]"
                : "border border-transparent text-[#cdbdaf] hover:bg-[rgba(255,248,242,0.04)] hover:text-[#fff4ea]"
            }`}
            href={item.href}
          >
            <span className={`mr-2 h-1.5 w-1.5 rounded-full transition ${isActive ? "bg-[rgba(201,167,110,0.88)]" : "bg-[rgba(201,167,110,0.24)] group-hover:bg-[rgba(201,167,110,0.54)]"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

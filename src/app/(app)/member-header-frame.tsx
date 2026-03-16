"use client";

import { useEffect, useState } from "react";

export function MemberHeaderFrame({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 36);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="member-header-shell" data-scrolled={scrolled ? "true" : "false"}>
      {children}
    </div>
  );
}

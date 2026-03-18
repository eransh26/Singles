"use client";

import { useEffect, useMemo, useState } from "react";

function formatRelativeLabel(value: string, now: number) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diff = Math.max(0, now - timestamp);

  if (diff < 60_000) {
    return "Just now";
  }

  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(diff / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const label = useMemo(() => formatRelativeLabel(value, now), [now, value]);

  return (
    <time className={className} dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}

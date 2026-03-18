"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useState } from "react";

export function ContextualPushPrompt({
  title = "Enable instant alerts",
  body = "Want instant alerts for messages and requests?",
}: {
  title?: string;
  body?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  if (dismissed) {
    return null;
  }

  async function dismissPrompt() {
    setIsPending(true);
    try {
      await fetch("/api/push/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      setDismissed(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-[1rem] border border-[color:rgba(124,74,110,0.14)] bg-[color:var(--lux-highlight-soft)] px-4 py-3 text-sm text-[color:var(--lux-text-secondary)] shadow-[0_10px_22px_rgba(43,43,43,0.035)]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--lux-accent-deep)] shadow-[0_6px_14px_rgba(43,43,43,0.06)]">
          <Bell className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="font-medium text-[color:var(--lux-text)]">{title}</p>
          <p className="mt-1 leading-6">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link className="lux-button-secondary" href="/settings#notifications">Enable instant alerts</Link>
        <button
          aria-label="Dismiss instant alerts prompt"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white text-[color:var(--lux-text-muted)] transition hover:text-[color:var(--lux-text)] disabled:opacity-60"
          disabled={isPending}
          onClick={() => void dismissPrompt()}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

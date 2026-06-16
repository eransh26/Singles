"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
};

export function BottomSheet({ open, onClose, title, description, children, className, ...rest }: BottomSheetProps) {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center"
      data-testid={rest["data-testid"]}
      role="dialog"
    >
      <button
        aria-label="Close"
        className="absolute inset-0 bg-[rgba(12,9,7,0.6)] backdrop-blur-sm motion-safe:animate-[sheet-overlay-in_180ms_ease-out]"
        onClick={onClose}
        type="button"
      />
      <div
        className={cn(
          "relative w-full max-w-xl rounded-t-[1.75rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-card)] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-18px_44px_rgba(7,8,10,0.4)] motion-safe:animate-[sheet-panel-in_220ms_ease-out]",
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[color:var(--lux-border-strong)]" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-[1.05rem] font-semibold tracking-tight text-[color:var(--lux-text)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{description}</p> : null}
          </div>
          <button
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--lux-border)] text-[color:var(--lux-text-secondary)] transition hover:text-[color:var(--lux-text)]"
            onClick={onClose}
            type="button"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

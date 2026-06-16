import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type StateAction = { label: string; href: string };

/* Concentric-circle motif used by splash + empty states. */
function ConcentricMotif() {
  return (
    <div aria-hidden className="relative mx-auto mb-5 h-20 w-20">
      {[80, 56, 32].map((size) => (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--ev-line-2)]"
          key={size}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
  "data-testid": testId,
}: {
  title: string;
  body?: string;
  action?: StateAction;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      className={cn("ev-card flex flex-col items-center px-6 py-10 text-center", className)}
      data-testid={testId}
    >
      <ConcentricMotif />
      <p className="ev-display text-[1.25rem] font-medium text-[color:var(--ev-text)]">{title}</p>
      {body ? <p className="mt-2 max-w-[22rem] text-sm leading-7 text-[color:var(--ev-text-2)]">{body}</p> : null}
      {action ? (
        <Link className="ev-btn-primary mt-6 px-6" href={action.href}>{action.label}</Link>
      ) : null}
    </div>
  );
}

export function LoadingState({ line = "Gathering your circle…" }: { line?: string }) {
  return (
    <div className="ev-card flex flex-col items-center gap-4 px-6 py-10 text-center" role="status">
      <span className="ev-spinner" />
      <p className="text-sm text-[color:var(--ev-text-2)]">{line}</p>
    </div>
  );
}

export function StatusBanner({
  tone = "success",
  children,
  className,
}: {
  tone?: "success" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(155,171,116,0.4)] bg-[color:var(--ev-sage-bg)] text-[color:var(--ev-sage-text)]"
      : "border-[rgba(192,138,160,0.4)] bg-[color:var(--ev-rose-bg)] text-[color:var(--ev-rose-text)]";

  return (
    <div className={cn("rounded-[var(--ev-r-input)] border px-4 py-3 text-sm leading-6", toneClass, className)} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/**
 * Honest locked/gated state. Copy must reflect real backing logic — never
 * imply KYC/18-plus is live unless it is. Use reasons like "Verify your email",
 * "Requires identity verification" (future), "Consent needed", "Mutual approval".
 */
export function LockedState({
  title,
  reason,
  action,
  className,
  "data-testid": testId,
}: {
  title: string;
  reason: string;
  action?: StateAction;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div className={cn("ev-card-locked rounded-[var(--ev-r-card)] px-5 py-6", className)} data-testid={testId}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[color:var(--ev-line-2)] bg-[color:var(--ev-bg-1)] text-[color:var(--ev-gold-text)]">
          <Lock className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--ev-text)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--ev-text-2)]">{reason}</p>
          {action ? (
            <Link className="ev-btn-gold-outline mt-4 inline-flex" href={action.href}>{action.label}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ComingSoon({
  title = "Not available yet",
  body = "This part of the circle is still being prepared. We'll open it when it's ready.",
  className,
}: {
  title?: string;
  body?: string;
  className?: string;
}) {
  return (
    <div className={cn("ev-card px-5 py-6 text-center", className)}>
      <p className="ev-label text-[color:var(--ev-gold-text)]">Coming soon</p>
      <p className="mt-2 ev-display text-[1.15rem] font-medium text-[color:var(--ev-text)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--ev-text-2)]">{body}</p>
    </div>
  );
}

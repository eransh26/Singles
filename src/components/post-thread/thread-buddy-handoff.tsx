import Link from "next/link";
import { ThreadSocialProof } from "@/components/post-thread/thread-social-proof";

type ThreadBuddyHandoffProps = {
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  signals?: string[];
  statusLabel?: string | null;
  title: string;
};

export function ThreadBuddyHandoff({
  body,
  ctaHref,
  ctaLabel,
  signals = [],
  statusLabel,
  title,
}: ThreadBuddyHandoffProps) {
  return (
    <section
      className="rounded-[1.45rem] border border-[rgba(156,129,110,0.18)] bg-[linear-gradient(180deg,rgba(56,43,38,0.18),rgba(21,19,21,0.64))] p-4 text-white shadow-[0_16px_32px_rgba(7,8,10,0.14)]"
      data-testid="thread-buddy-handoff"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">Buddy handoff</p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-white">{title}</h3>
        </div>
        {statusLabel ? (
          <span className="rounded-full border border-[rgba(229,181,98,0.18)] bg-[rgba(229,181,98,0.08)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#ebd4a5]">
            {statusLabel}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-6 text-white/72">{body}</p>
      <div className="mt-4">
        <ThreadSocialProof signals={signals} />
      </div>

      {ctaHref && ctaLabel ? (
        <div className="mt-4">
          <Link className="text-sm font-medium text-white/88 underline-offset-4 hover:underline" href={ctaHref}>
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

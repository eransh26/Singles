import Link from "next/link";

type ThreadContextPanelProps = {
  label: string;
  title: string;
  body: string;
  tone?: "default" | "featured" | "event" | "media";
  href?: string;
  ctaLabel?: string;
};

export function ThreadContextPanel({ label, title, body, tone = "default", href, ctaLabel }: ThreadContextPanelProps) {
  const toneClass =
    tone === "featured"
      ? "border-[rgba(195,145,88,0.22)] bg-[linear-gradient(180deg,rgba(74,49,30,0.18),rgba(26,22,21,0.64))]"
      : tone === "event"
        ? "border-[rgba(128,93,78,0.18)] bg-[linear-gradient(180deg,rgba(62,44,39,0.18),rgba(24,21,22,0.64))]"
        : tone === "media"
          ? "border-[rgba(111,118,132,0.18)] bg-[linear-gradient(180deg,rgba(37,40,48,0.20),rgba(20,22,27,0.62))]"
          : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]";

  return (
    <section className={`rounded-[1.45rem] border p-4 text-white shadow-[0_16px_32px_rgba(7,8,10,0.14)] ${toneClass}`} data-testid="thread-context-panel">
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">{label}</p>
      <h3 className="mt-2 text-base font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/72">{body}</p>
      {href && ctaLabel ? (
        <div className="mt-3">
          <Link className="text-sm font-medium text-white/88 underline-offset-4 hover:underline" href={href}>
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

import Link from "next/link";

export function FeatureUnavailableCard({
  eyebrow = "Unavailable",
  title,
  description,
  href = "/home",
  actionLabel = "Back home",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <main className="lux-shell">
      <section className="lux-card max-w-3xl space-y-4">
        <p className="lux-overline">{eyebrow}</p>
        <h1 className="text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">{title}</h1>
        <p className="text-sm leading-6 text-[color:var(--lux-text-secondary)]">{description}</p>
        <div className="pt-2">
          <Link className="lux-button-secondary" href={href}>{actionLabel}</Link>
        </div>
      </section>
    </main>
  );
}

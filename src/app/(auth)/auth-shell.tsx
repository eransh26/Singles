import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  description,
  alternateHref,
  alternateLabel,
  alternatePrompt,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
  alternatePrompt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="ev-app-frame flex min-h-screen flex-col bg-[color:var(--ev-bg-0)] px-6 py-10 text-[color:var(--ev-text)]">
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="space-y-3 text-center">
          <Link className="ev-display inline-block text-[2.4rem] font-medium tracking-tight text-[color:var(--ev-text)]" href="/">
            Evyta
          </Link>
          <p className="ev-label text-[color:var(--ev-gold-text)]">Evyta access · {eyebrow}</p>
          <h1 className="ev-display text-[1.9rem] font-medium leading-tight tracking-tight text-[color:var(--ev-text)]">{title}</h1>
          <p className="mx-auto max-w-[20rem] text-sm leading-7 text-[color:var(--ev-text-2)]">{description}</p>
        </div>

        <div className="ev-card ev-card-pad space-y-5 p-5">
          {children}
          <p className="rounded-[var(--ev-r-input)] border border-[color:var(--ev-line)] bg-[color:var(--ev-surface-2)] px-4 py-3 text-[13px] leading-6 text-[color:var(--ev-text-3)]">
            Evyta is in a quiet, invitation-led alpha. Access opens gradually. Private by design — your activity is never shown publicly.
          </p>
        </div>

        <p className="text-center text-sm text-[color:var(--ev-text-3)]">
          {alternatePrompt}{" "}
          <Link className="font-semibold text-[color:var(--ev-gold-text)] underline-offset-4 hover:underline" href={alternateHref}>
            {alternateLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}

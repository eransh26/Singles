import Image from "next/image";
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f4f1_0%,#f4efeb_100%)] px-4 py-6 text-[color:var(--lux-text)] md:px-6 md:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.85fr)] lg:items-stretch">
        <section className="relative overflow-hidden rounded-[2.3rem] border border-[color:var(--lux-accent-border)] bg-[linear-gradient(160deg,rgba(121,86,116,0.16),rgba(255,252,250,0.98)_36%,rgba(243,237,240,0.94))] p-6 shadow-[0_28px_64px_rgba(85,64,88,0.12)] md:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-[-6%] hidden w-80 items-center justify-center lg:flex">
            <div className="relative h-72 w-72 opacity-[0.08] saturate-[0.82]">
              <Image alt="" className="object-contain" fill sizes="288px" src="/brand/evyta-mark.svg" unoptimized />
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-8">
              <div className="max-w-[220px] md:max-w-[280px]">
                <Image alt="Evyta" className="h-auto w-full object-contain" height={84} priority src="/brand/evyta-logo.svg" unoptimized width={320} />
              </div>

              <div className="max-w-xl space-y-5">
                <p className="lux-overline text-[color:var(--lux-accent-strong)]">{eyebrow}</p>
                <h1 className="text-[2.6rem] font-semibold tracking-tight text-[color:var(--lux-text)] md:text-[3.5rem] md:leading-[1.02]">{title}</h1>
                <p className="text-base leading-8 text-[color:var(--lux-text-secondary)] md:max-w-lg">{description}</p>
              </div>

              <div className="grid gap-3 text-sm text-[color:var(--lux-text-secondary)] md:max-w-md">
                <div className="rounded-[1.4rem] border border-[color:var(--lux-accent-border)] bg-[rgba(255,255,255,0.56)] px-4 py-4">
                  <p className="lux-overline text-[color:var(--lux-accent-strong)]">Private access</p>
                  <p className="mt-3 leading-7">A discreet, adult member environment with privacy, trust, and quiet invitation at the center.</p>
                </div>
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-[color:var(--lux-accent-border)] bg-[rgba(255,255,255,0.46)] px-4 py-4">
                  <Image alt="Evyta seal" className="opacity-80" height={22} src="/brand/evyta-mark.svg" unoptimized width={22} />
                  <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--lux-accent-strong)]">Members only</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[color:var(--lux-accent-border)] pt-5 text-sm text-[color:var(--lux-text-muted)]">
              <p>Private member circle</p>
              <p>Evyta</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.1rem] border border-[color:var(--lux-accent-border)] bg-[linear-gradient(180deg,rgba(255,253,251,0.98),rgba(248,244,241,0.96))] p-6 text-[color:var(--lux-text)] shadow-[0_24px_54px_rgba(85,64,88,0.1)] md:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(134,96,125,0.1),transparent_70%)]" />
          <div className="relative flex h-full flex-col gap-6">
            <div className="space-y-3">
              <p className="lux-overline">Evyta access</p>
              <h2 className="text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)] md:text-[2.35rem] md:leading-[1.08]">{title}</h2>
              <p className="text-sm leading-7 text-[color:var(--lux-text-secondary)]">{description}</p>
            </div>

            <div className="flex-1">{children}</div>

            <p className="border-t border-[color:var(--lux-accent-border)] pt-5 text-sm text-[color:var(--lux-text-secondary)]">
              {alternatePrompt} <Link className="font-medium text-[color:var(--lux-accent-deep)] underline underline-offset-4" href={alternateHref}>{alternateLabel}</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

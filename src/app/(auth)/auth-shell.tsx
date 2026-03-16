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
    <main className="min-h-screen bg-[linear-gradient(180deg,#181310_0%,#14110f_100%)] px-4 py-6 text-[#fff4ea] md:px-6 md:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.85fr)] lg:items-stretch">
        <section className="relative overflow-hidden rounded-[2.3rem] border border-[rgba(201,167,110,0.18)] bg-[linear-gradient(160deg,rgba(35,29,25,0.96),rgba(24,20,17,0.98))] p-6 shadow-[0_28px_64px_rgba(0,0,0,0.24)] md:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-[-6%] hidden w-80 items-center justify-center lg:flex">
            <div className="relative h-72 w-72 opacity-[0.08]">
              <Image alt="" className="object-contain" fill sizes="288px" src="/brand/evyta-icon-512.png" />
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-8">
              <div className="max-w-[220px] md:max-w-[280px]">
                <Image alt="Evyta" className="h-auto w-full object-contain" height={84} priority src="/brand/evyta-logo.png" width={320} />
              </div>

              <div className="max-w-xl space-y-5">
                <p className="lux-overline text-[#bca999]">{eyebrow}</p>
                <h1 className="text-[2.6rem] font-semibold tracking-tight text-[#fff4ea] md:text-[3.5rem] md:leading-[1.02]">{title}</h1>
                <p className="text-base leading-8 text-[#c9bbae] md:max-w-lg">{description}</p>
              </div>

              <div className="grid gap-3 text-sm text-[#d7c8bb] md:max-w-md">
                <div className="rounded-[1.4rem] border border-[rgba(201,167,110,0.16)] bg-[rgba(255,248,242,0.04)] px-4 py-4">
                  <p className="lux-overline text-[#9f8c7d]">Private access</p>
                  <p className="mt-3 leading-7">A discreet, adult member environment with warm identity, privacy, and trust at the center.</p>
                </div>
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(201,167,110,0.14)] bg-[rgba(255,248,242,0.03)] px-4 py-4">
                  <Image alt="Evyta seal" height={22} src="/brand/evyta-icon-64.png" width={22} />
                  <p className="text-sm uppercase tracking-[0.18em] text-[#bca999]">Members only</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[rgba(201,167,110,0.14)] pt-5 text-sm text-[#aa9788]">
              <p>Private member circle</p>
              <p>Evyta</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.1rem] border border-[rgba(201,167,110,0.16)] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(247,243,238,0.96))] p-6 text-[color:var(--lux-text)] shadow-[0_24px_54px_rgba(0,0,0,0.14)] md:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(198,166,107,0.12),transparent_70%)]" />
          <div className="relative flex h-full flex-col gap-6">
            <div className="space-y-3">
              <p className="lux-overline">Evyta access</p>
              <h2 className="text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)] md:text-[2.35rem] md:leading-[1.08]">{title}</h2>
              <p className="text-sm leading-7 text-[color:var(--lux-text-secondary)]">{description}</p>
            </div>

            <div className="flex-1">{children}</div>

            <p className="border-t border-[color:rgba(179,154,136,0.18)] pt-5 text-sm text-[color:var(--lux-text-secondary)]">
              {alternatePrompt} <Link className="font-medium text-[color:var(--lux-text)] underline underline-offset-4" href={alternateHref}>{alternateLabel}</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function SplashPage() {
  return (
    <main className="ev-app-frame relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-[color:var(--ev-bg-0)] px-6 py-14 text-center text-[color:var(--ev-text)]">
      {/* Concentric-circle motif — built from plain bordered circles */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2">
        {[420, 320, 220, 130].map((size) => (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--ev-line)]"
            key={size}
            style={{ width: size, height: size }}
          />
        ))}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-5">
        <p className="ev-label text-[color:var(--ev-gold-text)]">Private members&rsquo; circle</p>
        <h1 className="ev-display text-[3.4rem] font-medium leading-none tracking-tight text-[color:var(--ev-text)]">Evyta</h1>
        <p className="ev-display max-w-[18rem] text-[1.5rem] italic leading-snug text-[color:var(--ev-text-2)]">
          See the circle, not the noise.
        </p>
        <p className="max-w-[20rem] text-[15px] leading-7 text-[color:var(--ev-text-3)]">
          A discreet, trust-first space for intentional connection — calm by design.
        </p>
      </div>

      <div className="relative w-full max-w-[20rem] space-y-4">
        <Link className="ev-btn-primary w-full" href="/register">I Want In</Link>
        <p className="text-sm text-[color:var(--ev-text-3)]">
          Already inside?{" "}
          <Link className="font-semibold text-[color:var(--ev-gold-text)] underline-offset-4 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

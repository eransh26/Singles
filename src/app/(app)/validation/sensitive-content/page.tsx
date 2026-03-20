export default function SensitiveContentValidationPage() {
  return (
    <main className="lux-shell max-w-3xl">
      <section className="lux-hero">
        <p className="lux-overline">Sensitive content</p>
        <h1 className="lux-title mt-3">Verification is required before viewing sensitive images.</h1>
        <p className="lux-body mt-4">Text stays visible in the feed, but sensitive media stays gated until the required verification flow is completed.</p>
      </section>
      <section className="lux-card">
        <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Validation placeholder</p>
        <p className="mt-3 text-sm leading-7 text-[color:var(--lux-text-secondary)]">This route is intentionally simple for now so stronger validation checks can be added later without changing the feed behavior.</p>
      </section>
    </main>
  );
}

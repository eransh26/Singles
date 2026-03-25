type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro?: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, title, intro, sections }: LegalPageProps) {
  return (
    <main className="lux-shell max-w-4xl">
      <section className="lux-hero">
        <p className="lux-overline">{eyebrow}</p>
        <h1 className="lux-title mt-3">{title}</h1>
        {intro ? <p className="lux-body mt-4 max-w-3xl">{intro}</p> : null}
      </section>

      <section className="lux-card px-5 py-6 md:px-8 md:py-8" data-testid="legal-document">
        <div className="mx-auto max-w-3xl space-y-8 md:space-y-10">
          {sections.map((section, index) => (
            <section key={section.title} className="space-y-3 md:space-y-4">
              <h2 className="text-[1.1rem] font-semibold tracking-tight text-[color:var(--lux-text)] md:text-[1.22rem]">
                {index + 1}. {section.title}
              </h2>
              <div className="space-y-3 text-[15px] leading-7 text-[color:var(--lux-text-secondary)] md:space-y-4 md:text-base md:leading-8">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

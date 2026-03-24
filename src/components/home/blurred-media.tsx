type HomeBlurredMediaProps = {
  src: string;
  alt: string;
  sensitive?: boolean;
  href?: string;
};

export function HomeBlurredMedia({ src, alt, sensitive = false, href }: HomeBlurredMediaProps) {
  const image = (
    <img
      alt={alt}
      className={`h-full max-h-[16.5rem] w-full object-cover transition duration-300 md:max-h-[17.5rem] ${sensitive ? "scale-[1.02] blur-2xl" : ""}`}
      src={src}
    />
  );

  if (!sensitive) {
    return (
      <div className="overflow-hidden rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]" data-testid="home-feed-media">
        {image}
      </div>
    );
  }

  const content = (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]" data-testid="home-feed-media-sensitive">
      {image}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,14,16,0.72)] via-[rgba(14,14,16,0.34)] to-[rgba(14,14,16,0.18)]" />
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(20,20,24,0.48)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white/86 backdrop-blur">
        <span>Sensitive media</span>
        <span className="text-white/70">Tap to reveal</span>
      </div>
    </div>
  );

  return href ? <a href={href}>{content}</a> : content;
}

type ThreadSocialProofProps = {
  signals: string[];
};

export function ThreadSocialProof({ signals }: ThreadSocialProofProps) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="thread-social-proof">
      {signals.map((signal) => (
        <span
          className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/60"
          key={signal}
        >
          {signal}
        </span>
      ))}
    </div>
  );
}

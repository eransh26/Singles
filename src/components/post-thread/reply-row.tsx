import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { PREMIUM_BODY, PREMIUM_PANEL } from "@/components/ui/premium-styles";

type ReplyRowProps = {
  reply: {
    id: string;
    contentText: string;
    createdAt: string;
    authorHref: string;
    authorLabel: string;
    authorInitial: string;
    trustTier: "LOW" | "NORMAL" | "HIGH" | null;
    emailVerified: boolean;
    phoneVerified: boolean;
  };
};

export function ReplyRow({ reply }: ReplyRowProps) {
  return (
    <article className={`${PREMIUM_PANEL} px-4 py-4`} data-testid="thread-reply-row">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-xs font-semibold text-white/82">
          {reply.authorInitial}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link className="truncate text-sm font-semibold tracking-tight text-white underline-offset-4 hover:underline" href={reply.authorHref}>
              {reply.authorLabel}
            </Link>
            <HomeTrustBadge compact emailVerified={reply.emailVerified} phoneVerified={reply.phoneVerified} tier={reply.trustTier as never} />
            <RelativeTime className="text-[11px] tracking-[0.08em] text-white/42" value={reply.createdAt} />
          </div>
          <p className={`${PREMIUM_BODY} whitespace-pre-wrap`}>{reply.contentText}</p>
        </div>
      </div>
    </article>
  );
}

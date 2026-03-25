"use client";

import Link from "next/link";
import { VerificationStatus } from "@prisma/client";
import { useOptimistic, useTransition } from "react";
import { ArrowRight, CalendarDays, Loader2, Lock, Sparkles, Users } from "lucide-react";
import { togglePostReactionAction } from "@/app/(app)/actions";
import { ContextChips } from "@/components/discovery/context-chips";
import { HomeTrustBadge } from "@/components/home/trust-badge";
import { PREMIUM_ACTION, PREMIUM_BODY, PREMIUM_META, PREMIUM_SURFACE, PREMIUM_TITLE } from "@/components/ui/premium-styles";

type EventReactionType = "SUPPORT" | "CELEBRATE" | null;

type EventSignalCardProps = {
  body: string;
  chips: string[];
  ctaHref: string;
  ctaLabel: string;
  emailVerified?: boolean;
  goingCount: number;
  groupId?: string | null;
  interestedCount: number;
  overline: string;
  phoneVerified?: boolean;
  kycVerified?: boolean;
  verificationStatus?: VerificationStatus | null;
  isBuddyApproved?: boolean;
  postId?: string | null;
  privacyLabel: string;
  reactionType: EventReactionType;
  scopeLabel?: string | null;
  signals?: string[];
  statusNote: string;
  timingLabel: string;
  title: string;
  trustTier?: "LOW" | "NORMAL" | "HIGH" | null;
};

type CardState = {
  goingCount: number;
  interestedCount: number;
  reactionType: EventReactionType;
};

function reducer(current: CardState, nextReactionType: Exclude<EventReactionType, null>) {
  const nextState = { ...current };
  if (current.reactionType === "SUPPORT") {
    nextState.interestedCount = Math.max(0, nextState.interestedCount - 1);
  }
  if (current.reactionType === "CELEBRATE") {
    nextState.goingCount = Math.max(0, nextState.goingCount - 1);
  }
  if (current.reactionType === nextReactionType) {
    nextState.reactionType = null;
    return nextState;
  }
  if (nextReactionType === "SUPPORT") {
    nextState.interestedCount += 1;
  }
  if (nextReactionType === "CELEBRATE") {
    nextState.goingCount += 1;
  }
  nextState.reactionType = nextReactionType;
  return nextState;
}

function ActionButton({ active, count, disabled, label, onClick }: { active: boolean; count: number; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`${PREMIUM_ACTION} ${active ? "border-[rgba(229,181,98,0.3)] bg-[rgba(229,181,98,0.16)] text-[#f4ddb0]" : ""}`}
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      <span>{label}</span>
      <span className="text-white/54">{count}</span>
    </button>
  );
}

export function EventSignalCard({ body, chips, ctaHref, ctaLabel, emailVerified = false, goingCount, groupId, interestedCount, overline, phoneVerified = false, kycVerified = false, verificationStatus = null, isBuddyApproved = false, postId, privacyLabel, reactionType, scopeLabel, signals = [], statusNote, timingLabel, title, trustTier = null }: EventSignalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [state, updateState] = useOptimistic<CardState, Exclude<EventReactionType, null>>({ interestedCount, goingCount, reactionType }, reducer);

  function chooseReaction(nextReactionType: Exclude<EventReactionType, null>) {
    if (!postId) {
      return;
    }
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("reactionType", nextReactionType);
    if (groupId) {
      formData.set("groupId", groupId);
    }
    startTransition(async () => {
      updateState(nextReactionType);
      await togglePostReactionAction(formData);
    });
  }

  return (
    <article className={`${PREMIUM_SURFACE} border-[rgba(128,93,78,0.18)] bg-[linear-gradient(180deg,rgba(62,44,39,0.22),rgba(24,21,22,0.82))] p-4 hover:-translate-y-0.5`} data-testid="event-signal-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-white/48">
              <CalendarDays className="h-3.5 w-3.5" />
              {overline}
            </span>
            {trustTier ? <HomeTrustBadge compact emailVerified={emailVerified} isBuddyApproved={isBuddyApproved} kycVerified={kycVerified} phoneVerified={phoneVerified} tier={trustTier as never} verificationStatus={verificationStatus} /> : null}
          </div>
          <div className="space-y-2">
            <h3 className={PREMIUM_TITLE}>{title}</h3>
            <p className={PREMIUM_BODY}>{body}</p>
          </div>
        </div>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/56">{timingLabel}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/58">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5">
          <Lock className="h-3.5 w-3.5" />
          {privacyLabel}
        </span>
        {scopeLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5" />
            {scopeLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(229,181,98,0.18)] bg-[rgba(229,181,98,0.08)] px-3 py-1.5 text-[#ead2a1]">
          <Sparkles className="h-3.5 w-3.5" />
          {statusNote}
        </span>
      </div>

      {chips.length > 0 ? <div className="mt-4"><ContextChips chips={chips} /></div> : null}

      <div className={`mt-4 flex flex-wrap gap-2 ${PREMIUM_META}`} data-testid="event-card-social-signals">
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5">{state.goingCount} going</span>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5">{state.interestedCount} interested</span>
        {signals.map((signal) => (
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5" key={signal}>{signal}</span>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {postId ? (
          <div className="flex flex-wrap gap-2" data-testid="event-card-participation-actions">
            <ActionButton active={state.reactionType === "SUPPORT"} count={state.interestedCount} disabled={isPending} label="Interested" onClick={() => chooseReaction("SUPPORT")} />
            <ActionButton active={state.reactionType === "CELEBRATE"} count={state.goingCount} disabled={isPending} label="Going" onClick={() => chooseReaction("CELEBRATE")} />
          </div>
        ) : <div />}

        <Link className="inline-flex items-center gap-2 text-sm font-medium text-white/84 transition duration-200 hover:text-white" href={ctaHref} target={ctaHref.startsWith("http") ? "_blank" : undefined} rel={ctaHref.startsWith("http") ? "noreferrer" : undefined}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

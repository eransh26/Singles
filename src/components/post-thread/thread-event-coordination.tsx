"use client";

import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from "react";
import { CalendarDays, Loader2, Lock, MapPinned, Sparkles, Users } from "lucide-react";
import { togglePostReactionAction } from "@/app/(app)/actions";

type EventReactionType = "SUPPORT" | "CELEBRATE" | null;

type EventParticipationState = {
  interestedCount: number;
  goingCount: number;
  reactionType: EventReactionType;
};

type EventParticipationContextValue = {
  isPending: boolean;
  state: EventParticipationState;
  chooseReaction: (reactionType: Exclude<EventReactionType, null>) => void;
};

type ThreadEventParticipationProviderProps = {
  children: ReactNode;
  groupId?: string | null;
  initialGoingCount: number;
  initialInterestedCount: number;
  initialReactionType: EventReactionType;
  postId: string;
};

type ThreadEventContextPanelProps = {
  body: string;
  capacityLabel?: string | null;
  href: string;
  privacyLabel: string;
  scopeLabel?: string | null;
  signals?: string[];
  statusNote: string;
  timingLabel: string;
  title: string;
};

type ThreadEventParticipationActionsProps = {
  layout?: "panel" | "bar";
};

const EventParticipationContext = createContext<EventParticipationContextValue | null>(null);

function eventParticipationReducer(current: EventParticipationState, nextReactionType: Exclude<EventReactionType, null>) {
  const nextState = {
    interestedCount: current.interestedCount,
    goingCount: current.goingCount,
    reactionType: current.reactionType,
  };

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

function useThreadEventParticipation() {
  const context = useContext(EventParticipationContext);
  if (!context) {
    throw new Error("Thread event participation must be used inside its provider.");
  }
  return context;
}

export function ThreadEventParticipationProvider({
  children,
  groupId,
  initialGoingCount,
  initialInterestedCount,
  initialReactionType,
  postId,
}: ThreadEventParticipationProviderProps) {
  const [isPending, startTransition] = useTransition();
  const [state, updateState] = useOptimistic<EventParticipationState, Exclude<EventReactionType, null>>(
    {
      interestedCount: initialInterestedCount,
      goingCount: initialGoingCount,
      reactionType: initialReactionType,
    },
    eventParticipationReducer,
  );

  function chooseReaction(reactionType: Exclude<EventReactionType, null>) {
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("reactionType", reactionType);
    if (groupId) {
      formData.set("groupId", groupId);
    }

    startTransition(async () => {
      updateState(reactionType);
      await togglePostReactionAction(formData);
    });
  }

  return (
    <EventParticipationContext.Provider
      value={{
        isPending,
        state,
        chooseReaction,
      }}
    >
      {children}
    </EventParticipationContext.Provider>
  );
}

function ActionButton({
  active,
  count,
  disabled,
  label,
  layout,
  onClick,
}: {
  active: boolean;
  count: number;
  disabled: boolean;
  label: string;
  layout: "panel" | "bar";
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium uppercase tracking-[0.16em] transition ${
        active
          ? "border-[rgba(229,181,98,0.3)] bg-[rgba(229,181,98,0.16)] text-[#f4ddb0]"
          : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/72 hover:bg-[rgba(255,255,255,0.06)]"
      } ${layout === "bar" ? "min-w-[96px]" : ""}`}
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

export function ThreadEventParticipationActions({ layout = "panel" }: ThreadEventParticipationActionsProps) {
  const { chooseReaction, isPending, state } = useThreadEventParticipation();

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${layout === "bar" ? "justify-end" : ""}`}
      data-testid={layout === "bar" ? "thread-event-action-bar-actions" : "thread-event-participation-actions"}
    >
      <ActionButton
        active={state.reactionType === "SUPPORT"}
        count={state.interestedCount}
        disabled={isPending}
        label="Interested"
        layout={layout}
        onClick={() => chooseReaction("SUPPORT")}
      />
      <ActionButton
        active={state.reactionType === "CELEBRATE"}
        count={state.goingCount}
        disabled={isPending}
        label="Going"
        layout={layout}
        onClick={() => chooseReaction("CELEBRATE")}
      />
    </div>
  );
}

export function ThreadEventContextPanel({
  body,
  capacityLabel,
  href,
  privacyLabel,
  scopeLabel,
  signals = [],
  statusNote,
  timingLabel,
  title,
}: ThreadEventContextPanelProps) {
  const { state } = useThreadEventParticipation();

  return (
    <section
      className="rounded-[1.45rem] border border-[rgba(128,93,78,0.18)] bg-[linear-gradient(180deg,rgba(62,44,39,0.18),rgba(24,21,22,0.64))] p-4 text-white shadow-[0_16px_32px_rgba(7,8,10,0.14)]"
      data-testid="thread-event-context-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">Event context</p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-white">{title}</h3>
        </div>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/56">
          {timingLabel}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-white/72">{body}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/58">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {timingLabel}
        </span>
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
        {capacityLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5">
            <MapPinned className="h-3.5 w-3.5" />
            {capacityLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/58">
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5">{state.goingCount} going</span>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5">{state.interestedCount} interested</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(229,181,98,0.18)] bg-[rgba(229,181,98,0.08)] px-3 py-1.5 text-[#ead2a1]">
          <Sparkles className="h-3.5 w-3.5" />
          {statusNote}
        </span>
        {signals.map((signal) => (
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5" key={signal}>
            {signal}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ThreadEventParticipationActions />
        <a className="text-sm font-medium text-white/88 underline-offset-4 hover:underline" href={href} rel="noreferrer" target="_blank">
          View event
        </a>
      </div>
    </section>
  );
}

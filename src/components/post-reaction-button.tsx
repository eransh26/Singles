"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { HandHeart, Heart, PartyPopper, ThumbsUp } from "lucide-react";
import { togglePostReactionAction } from "@/app/(app)/actions";

type ReactionType = "LOVE" | "SUPPORT" | "THUMBS_UP" | "CELEBRATE";

type ReactionState = {
  count: number;
  reactionType: ReactionType | null;
};

const REACTION_OPTIONS: Array<{
  type: ReactionType;
  label: string;
  icon: typeof Heart;
  buttonClass: string;
  activeClass: string;
}> = [
  {
    type: "LOVE",
    label: "Love",
    icon: Heart,
    buttonClass: "text-rose-500 hover:bg-[rgba(124,74,110,0.08)] hover:text-rose-600",
    activeClass: "bg-[rgba(124,74,110,0.12)] text-rose-600",
  },
  {
    type: "SUPPORT",
    label: "Support",
    icon: HandHeart,
    buttonClass: "text-[color:#8A6280] hover:bg-[rgba(138,98,128,0.10)] hover:text-[color:#7C4A6E]",
    activeClass: "bg-[rgba(138,98,128,0.14)] text-[color:#7C4A6E]",
  },
  {
    type: "THUMBS_UP",
    label: "Thumbs up",
    icon: ThumbsUp,
    buttonClass: "text-sky-600 hover:bg-[rgba(90,126,168,0.10)] hover:text-sky-700",
    activeClass: "bg-[rgba(90,126,168,0.14)] text-sky-700",
  },
  {
    type: "CELEBRATE",
    label: "Celebrate",
    icon: PartyPopper,
    buttonClass: "text-amber-600 hover:bg-[rgba(201,146,61,0.10)] hover:text-amber-700",
    activeClass: "bg-[rgba(201,146,61,0.16)] text-amber-700",
  },
];

const ACTIVE_TONE: Record<ReactionType, string> = {
  LOVE: "text-rose-600",
  SUPPORT: "text-[color:#7C4A6E]",
  THUMBS_UP: "text-sky-700",
  CELEBRATE: "text-amber-700",
};

export function PostReactionButton({
  groupId,
  initialCount,
  initialReactionType,
  postId,
}: {
  groupId?: string | null;
  initialCount: number;
  initialReactionType: ReactionType | null;
  postId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, updateState] = useOptimistic<ReactionState, ReactionType>(
    { count: initialCount, reactionType: initialReactionType },
    (current, nextType) => {
      if (current.reactionType === nextType) {
        return { count: Math.max(0, current.count - 1), reactionType: null };
      }

      return {
        count: current.reactionType ? current.count : current.count + 1,
        reactionType: nextType,
      };
    },
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const activeOption = REACTION_OPTIONS.find((option) => option.type === state.reactionType) ?? REACTION_OPTIONS[0];
  const ActiveIcon = activeOption.icon;
  const activeTone = state.reactionType ? ACTIVE_TONE[state.reactionType] : "text-[color:var(--lux-text-muted)] hover:text-[color:var(--lux-text-secondary)]";

  function chooseReaction(reactionType: ReactionType) {
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("reactionType", reactionType);
    if (groupId) {
      formData.set("groupId", groupId);
    }

    startTransition(async () => {
      updateState(reactionType);
      setOpen(false);
      await togglePostReactionAction(formData);
    });
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        className={`inline-flex items-center gap-2 transition ${activeTone}`}
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ActiveIcon className={`h-4 w-4 ${state.reactionType === "LOVE" ? "fill-current" : ""}`} />
        <span>{state.count}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-8 z-20 flex gap-1 rounded-full border border-[color:var(--lux-border)] bg-white px-2 py-2 shadow-[0_14px_30px_rgba(43,43,43,0.08)]">
          {REACTION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = state.reactionType === option.type;
            return (
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${isActive ? option.activeClass : option.buttonClass}`}
                key={option.type}
                onClick={() => chooseReaction(option.type)}
                title={option.label}
                type="button"
              >
                <Icon className={`h-4 w-4 ${option.type === "LOVE" && isActive ? "fill-current" : ""}`} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

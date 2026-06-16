"use client";

import { useOptimistic, useTransition } from "react";
import { HandHeart, PartyPopper, Sparkles, Waves } from "lucide-react";
import { togglePostReactionAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

type ReactionType = "LOVE" | "SUPPORT" | "THUMBS_UP" | "CELEBRATE";

type ReactionState = {
  count: number;
  reactionType: ReactionType | null;
};

// Calm, low-pressure labels mapped onto the existing ReactionType enum
// (no schema change). LOVE→Resonate, SUPPORT→Support, THUMBS_UP→Curious,
// CELEBRATE→Celebrate.
const REACTION_OPTIONS: Array<{ type: ReactionType; label: string; icon: typeof Waves }> = [
  { type: "LOVE", label: "Resonate", icon: Waves },
  { type: "SUPPORT", label: "Support", icon: HandHeart },
  { type: "THUMBS_UP", label: "Curious", icon: Sparkles },
  { type: "CELEBRATE", label: "Celebrate", icon: PartyPopper },
];

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
  const [isPending, startTransition] = useTransition();
  const [state, updateState] = useOptimistic<ReactionState, ReactionType>(
    { count: initialCount, reactionType: initialReactionType },
    (current, nextType) => {
      if (current.reactionType === nextType) {
        return { count: Math.max(0, current.count - 1), reactionType: null };
      }
      return { count: current.reactionType ? current.count : current.count + 1, reactionType: nextType };
    },
  );

  function chooseReaction(reactionType: ReactionType) {
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
    <div className="flex items-center gap-1.5">
      {REACTION_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = state.reactionType === option.type;

        return (
          <button
            aria-label={option.label}
            aria-pressed={isActive}
            className={cn("ev-chip shrink-0 normal-case tracking-normal", isActive && "ev-chip-on")}
            disabled={isPending}
            key={option.type}
            onClick={() => chooseReaction(option.type)}
            title={option.label}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span className="text-[12px] font-medium">{option.label}</span>
            {isActive && state.count > 0 ? <span className="text-[12px]">{state.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useCallback, useOptimistic, useRef, useState, useTransition } from "react";
import { HandHeart, Heart, Loader2, PartyPopper, ThumbsUp } from "lucide-react";
import { togglePostReactionAction } from "@/app/(app)/actions";
import { PREMIUM_ACTION, PREMIUM_SURFACE } from "@/components/ui/premium-styles";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

type ReactionType = "LOVE" | "SUPPORT" | "THUMBS_UP" | "CELEBRATE";

type ReactionState = {
  count: number;
  reactionType: ReactionType | null;
};

const REACTION_OPTIONS: Array<{
  type: ReactionType;
  label: string;
  icon: typeof Heart;
  activeClass: string;
}> = [
  { type: "LOVE", label: "Love", icon: Heart, activeClass: "border-[rgba(228,123,157,0.28)] bg-[rgba(228,123,157,0.14)] text-rose-200" },
  { type: "SUPPORT", label: "Support", icon: HandHeart, activeClass: "border-[rgba(177,136,116,0.26)] bg-[rgba(177,136,116,0.12)] text-[#e9d1c4]" },
  { type: "THUMBS_UP", label: "Thumbs up", icon: ThumbsUp, activeClass: "border-[rgba(116,150,191,0.26)] bg-[rgba(116,150,191,0.14)] text-sky-100" },
  { type: "CELEBRATE", label: "Celebrate", icon: PartyPopper, activeClass: "border-[rgba(229,181,98,0.28)] bg-[rgba(229,181,98,0.14)] text-[#f3ddb0]" },
];

export function PostReactionButton({ groupId, initialCount, initialReactionType, postId }: { groupId?: string | null; initialCount: number; initialReactionType: ReactionType | null; postId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const dismissMenu = useCallback(() => setOpen(false), []);
  const [state, updateState] = useOptimistic<ReactionState, ReactionType>(
    { count: initialCount, reactionType: initialReactionType },
    (current, nextType) => {
      if (current.reactionType === nextType) {
        return { count: Math.max(0, current.count - 1), reactionType: null };
      }
      return { count: current.reactionType ? current.count : current.count + 1, reactionType: nextType };
    },
  );

  useDismissibleLayer({ open, onDismiss: dismissMenu, refs: [containerRef], restoreFocusRef: triggerRef });

  const activeOption = REACTION_OPTIONS.find((option) => option.type === state.reactionType) ?? REACTION_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

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
      <button className={PREMIUM_ACTION} disabled={isPending} onClick={() => setOpen((value) => !value)} ref={triggerRef} type="button">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActiveIcon className={`h-4 w-4 ${state.reactionType === "LOVE" ? "fill-current" : ""}`} />}
        <span>{state.count}</span>
      </button>

      {open ? (
        <div className={`absolute left-0 top-12 z-20 flex gap-1 rounded-[1.1rem] p-2 ${PREMIUM_SURFACE}`}>
          {REACTION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = state.reactionType === option.type;
            return (
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  isActive
                    ? option.activeClass
                    : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/72 hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                }`}
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

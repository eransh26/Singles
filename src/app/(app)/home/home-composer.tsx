"use client";

import Link from "next/link";
import { HeartHandshake, Sparkles } from "lucide-react";
import { MediaComposer } from "@/components/media-composer";
import { PREMIUM_COMPOSER_SHELL, PREMIUM_COMPOSER_SHELL_ACTIVE, PREMIUM_ICON_HALO, PREMIUM_META } from "@/components/ui/premium-styles";

type HomeComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
  viewerName: string;
  requiresEmailVerification?: boolean;
  autoFocus?: boolean;
  firstPostMode?: boolean;
};

const PLACEHOLDERS = ["Share with your circle...", "What feels alive tonight?", "Leave a quiet signal..."];
const FIRST_POST_PROMPTS = [
  "Just arrived and saying hi.",
  "Looking around quietly tonight.",
  "Curious what feels warm in the circle.",
];

export function HomeComposer({ action, viewerName, requiresEmailVerification = false, autoFocus = false, firstPostMode = false }: HomeComposerProps) {
  const placeholder = firstPostMode ? "Say something simple. No need to impress." : PLACEHOLDERS[viewerName.length % PLACEHOLDERS.length];

  return (
    <section className={`${PREMIUM_COMPOSER_SHELL} ${PREMIUM_COMPOSER_SHELL_ACTIVE} p-4 md:p-5`} data-testid="home-composer">
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[1.1rem] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top,rgba(212,176,123,0.14),rgba(255,255,255,0.03)_68%)] text-sm font-semibold text-white/88 shadow-[0_8px_18px_rgba(18,12,9,0.08)]">
          {viewerName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/86">Share as {viewerName}</p>
              <p className={`${PREMIUM_META} mt-1`}>
                {requiresEmailVerification ? "Keep the circle trusted first" : firstPostMode ? "Start small and let people place you gently" : "A small update is enough to keep the room alive"}
              </p>
            </div>
          </div>

          {requiresEmailVerification ? (
            <div className="rounded-[1.2rem] border border-[rgba(255,255,255,0.07)] bg-[radial-gradient(circle_at_top,rgba(189,151,100,0.07),transparent_48%),rgba(255,255,255,0.026)] p-4 text-sm text-white/70" data-testid="home-verification-prompt">
              <div className="flex items-start gap-3">
                <span className={PREMIUM_ICON_HALO}>
                  <HeartHandshake className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium text-white/88">Keep the circle trusted</p>
                  <p className="mt-2 leading-6 text-white/62">
                    Verify your email before posting. You can keep browsing quietly while this step is waiting.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link className="lux-button-primary" href="/onboarding?step=3">Verify email</Link>
                <Link className="lux-button-secondary" href="/settings">Use another email</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {firstPostMode ? (
                <div className="flex items-start gap-3 rounded-[1.1rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3.5 py-3 text-sm text-white/64">
                  <span className={PREMIUM_ICON_HALO}>
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <p className="leading-6">The first post can be small. A simple check-in is enough to feel present here.</p>
                </div>
              ) : null}
              <MediaComposer
                action={action}
                allowAnonymous
                allowSensitive
                autoFocus={autoFocus}
                formClassName="flex flex-col gap-3 border-t border-[rgba(255,255,255,0.07)] pt-4"
                hiddenFields={[{ name: "sourcePath", value: "/home" }]}
                placeholder={placeholder}
                promptSuggestions={firstPostMode ? FIRST_POST_PROMPTS : []}
                submitLabel="Share"
                textareaClassName="border-transparent bg-transparent text-white/90 placeholder:text-white/30"
                tone="dark"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { MediaComposer } from "@/components/media-composer";
import { PREMIUM_COMPOSER_SHELL, PREMIUM_COMPOSER_SHELL_ACTIVE, PREMIUM_META } from "@/components/ui/premium-styles";

type HomeComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
  viewerName: string;
};

const PLACEHOLDERS = ["Share with your circle...", "What’s happening tonight?", "Start something..."];

export function HomeComposer({ action, viewerName }: HomeComposerProps) {
  const placeholder = PLACEHOLDERS[viewerName.length % PLACEHOLDERS.length];

  return (
    <section
      className={`${PREMIUM_COMPOSER_SHELL} ${PREMIUM_COMPOSER_SHELL_ACTIVE} p-4 md:p-5`}
      data-testid="home-composer"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-sm font-semibold text-white/88">
          {viewerName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/88">Share as {viewerName}</p>
              <p className={`${PREMIUM_META} mt-1`}>Start something soft and social</p>
            </div>
          </div>

          <MediaComposer
            action={action}
            allowAnonymous
            allowSensitive
            formClassName="flex flex-col gap-3 border-t border-[rgba(255,255,255,0.08)] pt-4"
            placeholder={placeholder}
            submitLabel="Share"
            textareaClassName="border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white placeholder:text-white/40"
            tone="dark"
          />
        </div>
      </div>
    </section>
  );
}

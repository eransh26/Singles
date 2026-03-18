"use client";

import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import { useState } from "react";

export function StartVideoCallButton({
  conversationId,
  mode,
}: {
  conversationId: string;
  mode: "start" | "join";
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCall() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Video calling is not available right now.");
        return;
      }

      router.push(`/video/${conversationId}`);
    } catch {
      setError("Video calling is not available right now.");
    } finally {
      setIsLoading(false);
    }
  }

  const label = mode === "join" ? "Join video call" : "Start video call";

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="lux-button-primary gap-2" data-testid="start-video-call-button" disabled={isLoading} onClick={startCall} type="button">
        <Video className="h-4 w-4" />
        {isLoading ? "Preparing call..." : label}
      </button>
      {error ? <p className="max-w-[240px] text-right text-xs text-[color:var(--lux-danger)]">{error}</p> : null}
    </div>
  );
}

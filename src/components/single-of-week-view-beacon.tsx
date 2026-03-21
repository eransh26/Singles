"use client";

import { useEffect } from "react";

export function SingleOfWeekViewBeacon({ featureId }: { featureId: string }) {
  useEffect(() => {
    void fetch("/api/single-of-the-week/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId }),
    }).catch(() => null);
  }, [featureId]);

  return null;
}

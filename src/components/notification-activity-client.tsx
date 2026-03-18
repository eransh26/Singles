"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function getActivityContext(pathname: string) {
  const chatMatch = pathname.match(/^\/chats\/([^/]+)$/);
  if (chatMatch) {
    return { contextType: "CHAT_CONVERSATION", contextId: chatMatch[1] };
  }

  const buddyMatch = pathname.match(/^\/buddy\/([^/]+)$/);
  if (buddyMatch) {
    return { contextType: "BUDDY_CONVERSATION", contextId: buddyMatch[1] };
  }

  return { contextType: "APP", contextId: null };
}

async function sendActivity(pathname: string, isVisible: boolean) {
  const context = getActivityContext(pathname);
  const body = JSON.stringify({
    pathname,
    contextType: context.contextType,
    contextId: context.contextId,
    isVisible,
  });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator && isVisible) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/activity", blob);
    return;
  }

  await fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function NotificationActivityClient() {
  const pathname = usePathname() ?? "/home";

  useEffect(() => {
    void sendActivity(pathname, document.visibilityState === "visible");

    const onVisibility = () => {
      void sendActivity(pathname, document.visibilityState === "visible");
    };

    const onFocus = () => {
      void sendActivity(pathname, true);
    };

    const interval = window.setInterval(() => {
      void sendActivity(pathname, document.visibilityState === "visible");
    }, 45_000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  return null;
}

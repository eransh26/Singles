"use client";

import { Bell, BellOff } from "lucide-react";
import { useState } from "react";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4 || 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function getCurrentSubscription() {
  const registration = await navigator.serviceWorker.register("/push-sw.js");
  return {
    registration,
    subscription: await registration.pushManager.getSubscription(),
  };
}

export function PushNotificationSettings({
  publicKey,
  isEnabled,
  deviceCount,
}: {
  publicKey: string;
  isEnabled: boolean;
  deviceCount: number;
}) {
  const [enabled, setEnabled] = useState(isEnabled);
  const [count, setCount] = useState(deviceCount);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const canEnable = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

  async function enablePush() {
    if (!canEnable) {
      setError("Instant alerts are not supported on this device.");
      return;
    }

    if (!publicKey) {
      setError("Instant alerts are not configured yet.");
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Allow notifications in your browser settings to enable instant alerts.");
        return;
      }

      const { registration, subscription: existingSubscription } = await getCurrentSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });

      const subscriptionJson = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subscriptionJson.keys,
          deviceLabel: navigator.userAgent.slice(0, 120),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Instant alerts could not be enabled.");
      }

      setEnabled(true);
      setCount(payload?.deviceCount ?? Math.max(1, count));
      setSuccess("Instant alerts enabled for this device.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Instant alerts could not be enabled.");
    } finally {
      setIsPending(false);
    }
  }

  async function disablePush() {
    setIsPending(true);
    setError(null);
    setSuccess(null);

    try {
      const { subscription } = await getCurrentSubscription();
      const endpoint = subscription?.endpoint ?? null;
      if (subscription) {
        await subscription.unsubscribe();
      }

      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Instant alerts could not be disabled.");
      }

      setEnabled(false);
      setCount(payload?.deviceCount ?? 0);
      setSuccess("Instant alerts disabled for this device.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Instant alerts could not be disabled.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.35rem] border border-[color:var(--lux-border)] bg-white p-4 shadow-[0_8px_20px_rgba(43,43,43,0.035)]">
        <div className="max-w-xl">
          <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">Enable instant alerts</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Receive discreet alerts for important activity like new requests, new messages, Buddy updates, and approved video access.</p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]">{enabled ? `Connected on ${count} device${count === 1 ? "" : "s"}` : "Instant alerts are currently off"}</p>
        </div>
        {enabled ? (
          <button className="lux-button-secondary gap-2" disabled={isPending} onClick={() => void disablePush()} type="button">
            <BellOff className="h-4 w-4" />
            {isPending ? "Updating..." : "Disable instant alerts"}
          </button>
        ) : (
          <button className="lux-button-primary gap-2" disabled={isPending} onClick={() => void enablePush()} type="button">
            <Bell className="h-4 w-4" />
            {isPending ? "Updating..." : "Enable instant alerts"}
          </button>
        )}
      </div>
      {success ? <p className="rounded-[1rem] border border-[color:rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] px-3 py-2 text-sm text-[color:var(--lux-success)]">{success}</p> : null}
      {error ? <p className="rounded-[1rem] border border-[color:rgba(138,89,100,0.18)] bg-[rgba(138,89,100,0.08)] px-3 py-2 text-sm text-[color:var(--lux-danger)]">{error}</p> : null}
    </div>
  );
}

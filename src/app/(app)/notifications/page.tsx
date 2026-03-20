import Link from "next/link";
import {
  markAllNotificationsReadAction,
  markAllNotificationsUnreadAction,
  updateSelectedNotificationsReadStateAction,
} from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getNotificationCopy, getNotificationPriority } from "@/lib/notification-definitions";
import { RelativeTime } from "@/components/relative-time";

const saveMessages: Record<string, string> = {
  "select-notifications": "Select at least one notification first.",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;

  const notifications = await prisma.notification.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      payloadJson: true,
      isRead: true,
      createdAt: true,
    },
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const savedMessage = resolvedSearchParams?.saved ? saveMessages[resolvedSearchParams.saved] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {savedMessage ? (
        <div className="rounded-[1.25rem] border border-[color:rgba(201,146,61,0.28)] bg-[rgba(201,146,61,0.08)] px-4 py-3 text-sm text-[color:var(--lux-text)]">
          {savedMessage}
        </div>
      ) : null}

      <section className="lux-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="lux-overline">Notifications</p>
            <h1 className="lux-title mt-3">A private inbox for the moments that matter.</h1>
            <p className="lux-body mt-4">
              Requests, approvals, and message alerts stay collected here so the rest of the experience can remain calm.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="lux-chip lux-chip-accent">Unread {unreadCount}</span>
            <Link className="lux-button-secondary" href="/settings#notifications">Enable instant alerts</Link>
            <form action={markAllNotificationsReadAction}>
              <button className="lux-button-secondary" type="submit">Mark all read</button>
            </form>
            <form action={markAllNotificationsUnreadAction}>
              <button className="lux-button-secondary" type="submit">Mark all unread</button>
            </form>
          </div>
        </div>
      </section>

      <form action={updateSelectedNotificationsReadStateAction} className="lux-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--lux-text-secondary)]">Select one or more notifications to update their read state.</p>
          <div className="flex flex-wrap gap-2">
            <button className="lux-button-secondary" name="nextState" type="submit" value="read">Mark selected read</button>
            <button className="lux-button-secondary" name="nextState" type="submit" value="unread">Mark selected unread</button>
          </div>
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="lux-empty">No notifications yet.</p>
          ) : (
            notifications.map((notification) => {
              const copy = getNotificationCopy(notification.type, notification.payloadJson);
              const priority = getNotificationPriority(notification.type);
              return (
                <label key={notification.id} className={`flex gap-3 rounded-[1.5rem] border p-4 text-sm ${notification.isRead ? "border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.72)]" : "border-[color:var(--lux-accent-border)] bg-[color:var(--lux-highlight-soft)]"}`}>
                  <input className="mt-1 size-4 shrink-0 accent-[color:var(--lux-accent)]" name="notificationIds" type="checkbox" value={notification.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <p className="text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{copy.title}</p>
                          {!notification.isRead ? <span className="lux-chip lux-chip-accent">Unread</span> : null}
                          <span className="lux-chip">{priority}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{copy.body}</p>
                        <RelativeTime className="mt-3 block text-xs uppercase tracking-[0.16em] text-[color:var(--lux-text-muted)]" value={notification.createdAt.toISOString()} />
                      </div>
                      <div className="flex gap-2">
                        <Link className="lux-button-secondary" href={copy.href}>Open</Link>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </form>
    </main>
  );
}

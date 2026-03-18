import Link from "next/link";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getNotificationCopy, getNotificationPriority } from "@/lib/notification-definitions";
import { RelativeTime } from "@/components/relative-time";

export default async function NotificationsPage() {
  const viewer = await requireUser();

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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
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
          </div>
        </div>
      </section>

      <section className="lux-card">
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="lux-empty">No notifications yet.</p>
          ) : (
            notifications.map((notification) => {
              const copy = getNotificationCopy(notification.type, notification.payloadJson);
              const priority = getNotificationPriority(notification.type);
              return (
                <div key={notification.id} className={`rounded-[1.5rem] border p-4 text-sm ${notification.isRead ? "border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.72)]" : "border-[color:var(--lux-accent-border)] bg-[color:var(--lux-highlight-soft)]"}`}>
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
                      {!notification.isRead ? (
                        <form action={markNotificationReadAction}>
                          <input name="notificationId" type="hidden" value={notification.id} />
                          <button className="lux-button-subtle" type="submit">Mark read</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

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
import { EmptyState, StatusBanner } from "@/components/ui/states";

const saveMessages: Record<string, string> = {
  "select-notifications": "Select at least one notification first.",
};

type NotificationRow = {
  id: string;
  type: Parameters<typeof getNotificationCopy>[0];
  payloadJson: Parameters<typeof getNotificationCopy>[1];
  isRead: boolean;
  createdAt: Date;
};

function NotificationItem({ notification }: { notification: NotificationRow }) {
  const copy = getNotificationCopy(notification.type, notification.payloadJson);
  const priority = getNotificationPriority(notification.type);

  return (
    <label
      className={`flex gap-3 rounded-[var(--ev-r-card)] border p-4 text-sm transition ${
        notification.isRead
          ? "border-[color:var(--ev-line)] bg-[color:var(--ev-surface)]"
          : "border-[rgba(201,164,92,0.3)] bg-[color:var(--ev-gold-bg)] ev-rail-gold"
      }`}
    >
      <input className="mt-1 size-4 shrink-0 accent-[color:var(--ev-gold)]" name="notificationIds" type="checkbox" value={notification.id} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-[color:var(--ev-text)]">{copy.title}</p>
          {!notification.isRead ? <span className="h-2 w-2 rounded-full bg-[color:var(--ev-gold)]" /> : null}
          <span className="ev-badge ev-badge-connected ml-auto py-0.5 text-[10px]">{priority}</span>
        </div>
        <p className="mt-1.5 leading-6 text-[color:var(--ev-text-2)]">{copy.body}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <RelativeTime className="text-[11px] text-[color:var(--ev-text-3)]" value={notification.createdAt.toISOString()} />
          <Link className="text-[13px] font-medium text-[color:var(--ev-gold-text)] underline-offset-4 hover:underline" href={copy.href}>Open</Link>
        </div>
      </div>
    </label>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = notifications.filter((notification) => notification.createdAt >= startOfToday);
  const earlier = notifications.filter((notification) => notification.createdAt < startOfToday);

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pb-[calc(var(--member-shell-bottom-offset)+1rem)] pt-4" data-testid="notifications-page">
      {savedMessage ? <StatusBanner className="mb-4" tone="error">{savedMessage}</StatusBanner> : null}

      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="ev-display text-[1.75rem] font-medium tracking-tight text-[color:var(--ev-text)]">Notifications</h1>
          <p className="mt-1 text-sm text-[color:var(--ev-text-2)]">{unreadCount > 0 ? `${unreadCount} new` : "You're all caught up"}</p>
        </div>
        <div className="flex flex-none gap-2">
          <form action={markAllNotificationsReadAction}>
            <button className="ev-btn-secondary px-3 py-2 text-[13px]" type="submit">Mark all read</button>
          </form>
          <form action={markAllNotificationsUnreadAction}>
            <button className="ev-btn-secondary px-3 py-2 text-[13px]" type="submit">Unread</button>
          </form>
        </div>
      </header>

      {notifications.length === 0 ? (
        <EmptyState body="When someone connects, resonates, or checks in, it'll appear here." title="Nothing yet" />
      ) : (
        <form action={updateSelectedNotificationsReadStateAction}>
          {today.length > 0 ? (
            <section className="mb-5">
              <p className="ev-label mb-2 text-[color:var(--ev-gold-text)]">Today</p>
              <div className="space-y-2">
                {today.map((notification) => <NotificationItem key={notification.id} notification={notification} />)}
              </div>
            </section>
          ) : null}

          {earlier.length > 0 ? (
            <section className="mb-5">
              <p className="ev-label mb-2 text-[color:var(--ev-text-3)]">Earlier</p>
              <div className="space-y-2">
                {earlier.map((notification) => <NotificationItem key={notification.id} notification={notification} />)}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-[color:var(--ev-line)] pt-4">
            <button className="ev-btn-secondary px-3 py-2 text-[13px]" name="nextState" type="submit" value="read">Mark selected read</button>
            <button className="ev-btn-secondary px-3 py-2 text-[13px]" name="nextState" type="submit" value="unread">Mark selected unread</button>
          </div>
        </form>
      )}
    </main>
  );
}

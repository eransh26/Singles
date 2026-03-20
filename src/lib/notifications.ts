import webpush from "web-push";
import { ActivityContextType, BuddyRequestAssignmentStatus, BuddyRequestStatus, ConversationKind, NotificationType, Prisma, type Notification } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getConversationTargetFromPayload,
  getEmailFallbackDelayMs,
  getEmailFallbackTemplate,
  getNotificationArea,
  getNotificationCopy,
  getNotificationPriority,
  getPushBatchWindowMs,
  getPushPayload,
  payloadField,
} from "@/lib/notification-definitions";

let webPushConfigured = false;

const SAME_CONTEXT_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const RECENT_APP_ACTIVE_WINDOW_MS = 3 * 60 * 1000;

function hasWebPushConfig() {
  return Boolean(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_CONTACT_EMAIL);
}

function ensureWebPushConfigured() {
  if (webPushConfigured || !hasWebPushConfig()) {
    return;
  }

  webpush.setVapidDetails(
    `mailto:${process.env.WEB_PUSH_CONTACT_EMAIL}`,
    process.env.WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );
  webPushConfigured = true;
}

export function getWebPushPublicKey() {
  return process.env.WEB_PUSH_PUBLIC_KEY ?? "";
}

export async function createNotificationRecord(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  type: NotificationType,
  payloadJson: Prisma.InputJsonValue,
) {
  return db.notification.create({
    data: {
      userId,
      type,
      payloadJson,
    },
    select: { id: true },
  });
}

export async function createNotificationWithDelivery(userId: string, type: NotificationType, payloadJson: Prisma.InputJsonValue) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      payloadJson,
    },
    select: { id: true },
  });

  await deliverNotification(notification.id);
  return notification;
}

export async function deliverNotifications(notificationIds: string[]) {
  await Promise.allSettled(notificationIds.map((notificationId) => deliverNotification(notificationId)));
}

async function queueEmailFallback(notification: Notification & { userId: string }) {
  const templateKey = getEmailFallbackTemplate(notification.type);
  if (!templateKey) {
    return;
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: notification.userId },
    select: { emailActivityEnabled: true },
  });

  if (settings?.emailActivityEnabled === false) {
    return;
  }

  const delayMs = getEmailFallbackDelayMs(notification.type);
  if (delayMs == null) {
    return;
  }

  await prisma.notificationEmailFallback.upsert({
    where: { notificationId: notification.id },
    update: {
      templateKey,
      payloadJson: notification.payloadJson as Prisma.InputJsonValue,
      availableAt: new Date(Date.now() + delayMs),
      onlyIfUnread: true,
    },
    create: {
      userId: notification.userId,
      notificationId: notification.id,
      templateKey,
      payloadJson: notification.payloadJson as Prisma.InputJsonValue,
      availableAt: new Date(Date.now() + delayMs),
      onlyIfUnread: true,
    },
  });
}

export type NotificationActivitySnapshot = {
  lastActiveAt: Date;
  contextType: ActivityContextType;
  contextId: string | null;
  isVisible: boolean;
};

type SmartPushContext = {
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
  settings: { webPushEnabled: boolean; silentModeEnabled: boolean; hideLockScreenTextEnabled: boolean } | null;
  activity: NotificationActivitySnapshot | null;
};

function conversationContextType(kind: ConversationKind) {
  return kind === ConversationKind.BUDDY_SUPPORT ? ActivityContextType.BUDDY_CONVERSATION : ActivityContextType.CHAT_CONVERSATION;
}

export async function getPushBatchCountForNotification(db: typeof prisma | Prisma.TransactionClient, notification: Notification & { userId: string }) {
  if (notification.type !== NotificationType.CHAT_MESSAGE_RECEIVED) {
    return 1;
  }

  const conversationId = payloadField(notification.payloadJson, "conversationId");
  if (!conversationId) {
    return 1;
  }

  const batchWindowMs = getPushBatchWindowMs(notification.type);
  const since = new Date(notification.createdAt.getTime() - batchWindowMs);

  return db.notification.count({
    where: {
      userId: notification.userId,
      type: NotificationType.CHAT_MESSAGE_RECEIVED,
      createdAt: { gte: since },
      payloadJson: {
        path: ["conversationId"],
        equals: conversationId,
      },
    },
  });
}

export async function hasRecentDeliveredBatchForNotification(db: typeof prisma | Prisma.TransactionClient, notification: Notification & { userId: string }) {
  if (notification.type !== NotificationType.CHAT_MESSAGE_RECEIVED) {
    return false;
  }

  const conversationId = payloadField(notification.payloadJson, "conversationId");
  if (!conversationId) {
    return false;
  }

  const batchWindowMs = getPushBatchWindowMs(notification.type);
  const since = new Date(notification.createdAt.getTime() - batchWindowMs);

  const recentDelivered = await db.notification.findFirst({
    where: {
      userId: notification.userId,
      type: NotificationType.CHAT_MESSAGE_RECEIVED,
      id: { not: notification.id },
      pushDeliveredAt: { gte: since },
      payloadJson: {
        path: ["conversationId"],
        equals: conversationId,
      },
    },
    select: { id: true },
  });

  return Boolean(recentDelivered);
}

export function shouldSuppressNotificationForActivity(notification: Pick<Notification, "type" | "payloadJson">, activity: NotificationActivitySnapshot | null) {
  if (!activity || !activity.isVisible) {
    return false;
  }

  const activeAgo = Date.now() - new Date(activity.lastActiveAt).getTime();
  const conversationTarget = getConversationTargetFromPayload(notification.payloadJson);

  if (notification.type === NotificationType.CHAT_MESSAGE_RECEIVED && conversationTarget) {
    if (activity.contextType === conversationContextType(conversationTarget.conversationKind) && activity.contextId === conversationTarget.conversationId && activeAgo <= SAME_CONTEXT_ACTIVE_WINDOW_MS) {
      return true;
    }

    if (activeAgo <= RECENT_APP_ACTIVE_WINDOW_MS) {
      return true;
    }
  }

  return false;
}

async function getSmartPushContext(notification: Notification & { userId: string }): Promise<SmartPushContext> {
  const [settings, subscriptions, activity] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId: notification.userId },
      select: { webPushEnabled: true, silentModeEnabled: true, hideLockScreenTextEnabled: true },
    }),
    prisma.webPushSubscription.findMany({
      where: { userId: notification.userId },
      select: { endpoint: true, p256dh: true, auth: true },
    }),
    prisma.userActivityState.findUnique({
      where: { userId: notification.userId },
      select: { lastActiveAt: true, contextType: true, contextId: true, isVisible: true },
    }),
  ]);

  return { settings, subscriptions, activity };
}

async function sendPush(notification: Notification & { userId: string }) {
  if (!hasWebPushConfig()) {
    return { sent: false, suppressed: false } as const;
  }

  if (getNotificationPriority(notification.type) !== "HIGH") {
    return { sent: false, suppressed: false } as const;
  }

  const context = await getSmartPushContext(notification);

  if (context.settings?.webPushEnabled === false || context.subscriptions.length === 0) {
    return { sent: false, suppressed: false } as const;
  }

  if (shouldSuppressNotificationForActivity(notification, context.activity)) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { pushSuppressedAt: new Date() },
    });
    return { sent: false, suppressed: true } as const;
  }

  if (await hasRecentDeliveredBatchForNotification(prisma, notification)) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { pushSuppressedAt: new Date() },
    });
    return { sent: false, suppressed: true } as const;
  }

  const batchCount = await getPushBatchCountForNotification(prisma, notification);
  const payloadInput = batchCount > 1
    ? ({ ...(notification.payloadJson as Record<string, unknown>), messageCount: batchCount } as unknown)
    : notification.payloadJson;

  const pushCopy = getPushPayload(notification.type, payloadInput, {
    hideLockScreenText: Boolean(context.settings?.hideLockScreenTextEnabled),
  });
  if (!pushCopy) {
    return { sent: false, suppressed: false } as const;
  }

  ensureWebPushConfigured();

  const copy = getNotificationCopy(notification.type, payloadInput);
  const payload = JSON.stringify({
    title: pushCopy.title,
    body: pushCopy.body,
    url: copy.href,
    tag: pushCopy.tag,
    silent: Boolean(context.settings?.silentModeEnabled),
  });

  await Promise.allSettled(
    context.subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { urgency: context.settings?.silentModeEnabled ? "very-low" : "normal", topic: pushCopy.tag },
        );
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.webPushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
        }
      }
    }),
  );

  await prisma.notification.update({
    where: { id: notification.id },
    data: { pushDeliveredAt: new Date(), pushSuppressedAt: null },
  });

  return { sent: true, suppressed: false } as const;
}

export async function deliverNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return;
  }

  await Promise.allSettled([sendPush(notification), queueEmailFallback(notification)]);
}

export async function getUnreadNotificationCounts(userId: string) {
  const [notifications, pendingBuddyAssignments, activeBuddyRequests] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, isRead: false },
      select: { type: true, payloadJson: true },
    }),
    prisma.buddyRequestAssignment.count({
      where: {
        buddyId: userId,
        status: BuddyRequestAssignmentStatus.PENDING,
        buddyRequest: { status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION] } },
      },
    }),
    prisma.buddyRequest.count({
      where: {
        seekerId: userId,
        status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] },
      },
    }),
  ]);

  const mutable = { total: notifications.length, chats: 0, buddy: 0 };

  for (const notification of notifications) {
    const area = getNotificationArea(notification.type, notification.payloadJson);
    if (area === "CHATS") mutable.chats += 1;
    if (area === "BUDDY") mutable.buddy += 1;
  }

  mutable.buddy = Math.max(mutable.buddy, pendingBuddyAssignments + activeBuddyRequests);

  return mutable;
}

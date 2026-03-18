import { ConversationKind, NotificationType } from "@prisma/client";

export type NotificationPriority = "HIGH" | "MEDIUM" | "LOW";
export type NotificationArea = "GENERAL" | "CHATS" | "BUDDY";

export type PushPrivacyOptions = {
  hideLockScreenText: boolean;
};

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
};

function payloadField(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function payloadNumber(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function payloadConversationKind(payload: unknown) {
  const value = payloadField(payload, "conversationKind");
  return value === ConversationKind.BUDDY_SUPPORT ? ConversationKind.BUDDY_SUPPORT : ConversationKind.MEMBER_CHAT;
}

export function getNotificationPriority(type: NotificationType): NotificationPriority {
  switch (type) {
    case NotificationType.CHAT_REQUEST_INCOMING:
    case NotificationType.CHAT_MESSAGE_RECEIVED:
    case NotificationType.BUDDY_REQUEST_INCOMING:
    case NotificationType.BUDDY_REQUEST_ASSIGNED:
    case NotificationType.VIDEO_REQUEST_APPROVED:
    case NotificationType.BUDDY_VIDEO_REQUEST_APPROVED:
      return "HIGH";
    case NotificationType.PHOTO_ACCESS_APPROVED:
    case NotificationType.BUDDY_REQUEST_DECISION_NEEDED:
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function getNotificationArea(type: NotificationType, payload: unknown): NotificationArea {
  switch (type) {
    case NotificationType.CHAT_REQUEST_INCOMING:
    case NotificationType.CHAT_REQUEST_ACCEPTED:
    case NotificationType.VIDEO_REQUEST_INCOMING:
    case NotificationType.VIDEO_REQUEST_APPROVED:
      return "CHATS";
    case NotificationType.CHAT_MESSAGE_RECEIVED:
      return payloadConversationKind(payload) === ConversationKind.BUDDY_SUPPORT ? "BUDDY" : "CHATS";
    case NotificationType.BUDDY_REQUEST_SUBMITTED:
    case NotificationType.BUDDY_REQUEST_INCOMING:
    case NotificationType.BUDDY_REQUEST_ASSIGNED:
    case NotificationType.BUDDY_REQUEST_DECISION_NEEDED:
    case NotificationType.BUDDY_REQUEST_NO_MATCH:
    case NotificationType.BUDDY_REQUEST_CANCELLED:
    case NotificationType.BUDDY_REQUEST_NO_LONGER_RELEVANT:
    case NotificationType.BUDDY_VIDEO_REQUEST_INCOMING:
    case NotificationType.BUDDY_VIDEO_REQUEST_APPROVED:
      return "BUDDY";
    default:
      return "GENERAL";
  }
}

export function getNotificationCopy(type: NotificationType, payload: unknown) {
  switch (type) {
    case NotificationType.CHAT_REQUEST_INCOMING:
      return {
        title: "New chat request",
        body: `${payloadField(payload, "fromDisplayName") ?? "A member"} wants to start a conversation with you.`,
        href: "/chats",
      };
    case NotificationType.CHAT_REQUEST_ACCEPTED:
      return {
        title: "Chat request accepted",
        body: `${payloadField(payload, "byDisplayName") ?? "A member"} accepted your chat request.`,
        href: payloadField(payload, "conversationId") ? `/chats/${payloadField(payload, "conversationId")}` : "/chats",
      };
    case NotificationType.CHAT_MESSAGE_RECEIVED: {
      const conversationId = payloadField(payload, "conversationId");
      const conversationKind = payloadConversationKind(payload);
      const messageCount = payloadNumber(payload, "messageCount") ?? 1;
      return {
        title: messageCount > 1 ? "New messages" : "New message",
        body: messageCount > 1
          ? `You have ${messageCount} new messages on Evyta.`
          : `You have a new message from ${payloadField(payload, "senderDisplayName") ?? "a member"}.`,
        href: conversationId
          ? conversationKind === ConversationKind.BUDDY_SUPPORT
            ? `/buddy/${conversationId}`
            : `/chats/${conversationId}`
          : conversationKind === ConversationKind.BUDDY_SUPPORT
            ? "/buddy"
            : "/chats",
      };
    }
    case NotificationType.VIDEO_REQUEST_INCOMING:
      return {
        title: "New video request",
        body: `${payloadField(payload, "requesterDisplayName") ?? "A member"} requested separate approval for video calls.`,
        href: payloadField(payload, "conversationId") ? `/chats/${payloadField(payload, "conversationId")}` : "/chats",
      };
    case NotificationType.VIDEO_REQUEST_APPROVED:
      return {
        title: "Video request approved",
        body: `${payloadField(payload, "approverDisplayName") ?? "A member"} approved video calls for your private chat.`,
        href: payloadField(payload, "conversationId") ? `/chats/${payloadField(payload, "conversationId")}` : "/chats",
      };
    case NotificationType.PHOTO_ACCESS_REQUEST_INCOMING:
      return {
        title: "New gallery request",
        body: `${payloadField(payload, "requesterDisplayName") ?? "A member"} asked to see your approved gallery.`,
        href: "/settings",
      };
    case NotificationType.PHOTO_ACCESS_APPROVED:
      return {
        title: "Gallery request approved",
        body: `${payloadField(payload, "ownerDisplayName") ?? "A member"} approved your gallery request.`,
        href: payloadField(payload, "ownerUserId") ? `/users/${payloadField(payload, "ownerUserId")}` : "/me",
      };
    case NotificationType.GROUP_JOIN_APPROVED:
      return {
        title: "Group request approved",
        body: `You can now access ${payloadField(payload, "groupName") ?? "your group"}.`,
        href: payloadField(payload, "groupId") ? `/groups/${payloadField(payload, "groupId")}` : "/groups",
      };
    case NotificationType.COMMENT_RECEIVED:
      return {
        title: "New comment on your post",
        body: `${payloadField(payload, "actorDisplayName") ?? "A member"} commented on your post.`,
        href: payloadField(payload, "groupId") ? `/groups/${payloadField(payload, "groupId")}` : "/home",
      };
    case NotificationType.BUDDY_REQUEST_SUBMITTED:
      return {
        title: "Buddy request submitted",
        body: "Your support request was shared with available Buddies.",
        href: "/buddy",
      };
    case NotificationType.BUDDY_REQUEST_INCOMING:
      return {
        title: "New Buddy request",
        body: "A new support request matches one of your Buddy domains.",
        href: "/buddy",
      };
    case NotificationType.BUDDY_REQUEST_ASSIGNED:
      return {
        title: "Buddy accepted",
        body: `${payloadField(payload, "buddyDisplayName") ?? "A Buddy"} accepted your support request.`,
        href: payloadField(payload, "conversationId") ? `/buddy/${payloadField(payload, "conversationId")}` : "/buddy",
      };
    case NotificationType.BUDDY_REQUEST_DECISION_NEEDED:
    case NotificationType.BUDDY_REQUEST_NO_MATCH:
      return {
        title: "Buddy request needs a decision",
        body: "No Buddy has accepted yet. You can extend or cancel your request.",
        href: "/buddy",
      };
    case NotificationType.BUDDY_REQUEST_CANCELLED:
      return {
        title: "Buddy request closed",
        body: payloadField(payload, "reason") === "expired"
          ? "Your Buddy request expired with no match."
          : "Your Buddy request was closed.",
        href: "/buddy",
      };
    case NotificationType.BUDDY_REQUEST_NO_LONGER_RELEVANT:
      return {
        title: "Buddy request no longer relevant",
        body: "Another Buddy accepted this support request first.",
        href: "/buddy",
      };
    case NotificationType.BUDDY_VIDEO_REQUEST_INCOMING:
      return {
        title: "Buddy video request",
        body: "A Buddy conversation requested separate video approval.",
        href: payloadField(payload, "conversationId") ? `/buddy/${payloadField(payload, "conversationId")}` : "/buddy",
      };
    case NotificationType.BUDDY_VIDEO_REQUEST_APPROVED:
      return {
        title: "Buddy video approved",
        body: "A Buddy video request was approved.",
        href: payloadField(payload, "conversationId") ? `/buddy/${payloadField(payload, "conversationId")}` : "/buddy",
      };
    default:
      return {
        title: "Notification",
        body: "There is an update waiting for you.",
        href: "/home",
      };
  }
}

export function getPushBatchWindowMs(type: NotificationType) {
  switch (type) {
    case NotificationType.CHAT_MESSAGE_RECEIVED:
      return 90_000;
    default:
      return 0;
  }
}

export function getEmailFallbackDelayMs(type: NotificationType) {
  switch (type) {
    case NotificationType.CHAT_REQUEST_INCOMING:
      return 45 * 60 * 1000;
    case NotificationType.BUDDY_REQUEST_INCOMING:
    case NotificationType.BUDDY_REQUEST_ASSIGNED:
    case NotificationType.BUDDY_REQUEST_DECISION_NEEDED:
      return 30 * 60 * 1000;
    case NotificationType.CHAT_MESSAGE_RECEIVED:
      return 90 * 60 * 1000;
    default:
      return null;
  }
}

export function getPushPayload(type: NotificationType, payload: unknown, options: PushPrivacyOptions): PushPayload | null {
  const generic = { title: "Evyta", body: "You have a new update on Evyta" };
  const hiddenText = { title: "Evyta", body: "You have a new notification on Evyta" };

  let resolved: { title: string; body: string } | null = null;

  switch (type) {
    case NotificationType.CHAT_REQUEST_INCOMING:
      resolved = { title: "Evyta", body: "You have a new request on Evyta" };
      break;
    case NotificationType.CHAT_MESSAGE_RECEIVED: {
      const count = payloadNumber(payload, "messageCount") ?? 1;
      resolved = {
        title: "Evyta",
        body: count > 1 ? `You have ${count} new messages on Evyta` : "You have a new message on Evyta",
      };
      break;
    }
    case NotificationType.BUDDY_REQUEST_INCOMING:
      resolved = { title: "Evyta", body: "You have a new support request" };
      break;
    case NotificationType.BUDDY_REQUEST_ASSIGNED:
      resolved = { title: "Evyta", body: "Your Buddy request was accepted" };
      break;
    case NotificationType.VIDEO_REQUEST_APPROVED:
    case NotificationType.BUDDY_VIDEO_REQUEST_APPROVED:
      resolved = { title: "Evyta", body: "A video request was approved" };
      break;
    default:
      resolved = null;
  }

  if (!resolved) {
    return null;
  }

  return {
    title: options.hideLockScreenText ? hiddenText.title : resolved.title,
    body: options.hideLockScreenText ? (type === NotificationType.CHAT_MESSAGE_RECEIVED ? hiddenText.body : generic.body) : resolved.body,
    tag: payloadField(payload, "conversationId") ?? `${type.toLowerCase()}`,
  };
}

export function getEmailFallbackTemplate(type: NotificationType) {
  switch (type) {
    case NotificationType.CHAT_REQUEST_INCOMING:
      return "chat_request_incoming";
    case NotificationType.BUDDY_REQUEST_ASSIGNED:
      return "buddy_request_accepted";
    case NotificationType.BUDDY_REQUEST_DECISION_NEEDED:
      return "buddy_request_decision_needed";
    case NotificationType.BUDDY_REQUEST_CANCELLED:
      return "buddy_request_closed";
    case NotificationType.BUDDY_REQUEST_INCOMING:
      return "buddy_request_incoming";
    case NotificationType.CHAT_MESSAGE_RECEIVED:
      return "chat_message_received";
    default:
      return null;
  }
}

export function getConversationTargetFromPayload(payload: unknown) {
  const conversationId = payloadField(payload, "conversationId");
  if (!conversationId) {
    return null;
  }

  return {
    conversationId,
    conversationKind: payloadConversationKind(payload),
  };
}

export { payloadField, payloadNumber, payloadConversationKind };

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  ActivityVisibility,
  ChatRequestPolicy,
  ChatRequestStatus,
  ConsentStatus,
  ConversationStatus,
  GroupJoinRequestStatus,
  GroupRole,
  GroupStatus,
  GroupType,
  MediaType,
  MediaVisibilityLevel,
  MembershipStatus,
  NotificationType,
  PhotoAccessRequestStatus,
  PhotoRequestPolicy,
  PostContextType,
  PostSensitivityStatus,
  ProfileVisibility,
  ReportTargetType,
  ReactionType,
  VerificationStatus,
} from "@prisma/client";
import { hasMinimalProfileVisibility, isFullyVerifiedUser, requireActiveUser, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { invalidatePairInteractionsByBlock, revokeChatConversationByPair, revokeVideoConsentForPair, userPairKey } from "@/lib/interaction-consent";
import { invalidateBuddyByBlock } from "@/lib/buddy";
import { createNotificationRecord, deliverNotification } from "@/lib/notifications";
import { canCreateSingleOfWeekRequest, syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { uploadProfileImageToR2 } from "@/lib/r2-media";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalTextValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function withSavedParam(path: string, saved: string) {
  return path.includes("?") ? `${path}&saved=${saved}` : `${path}?saved=${saved}`;
}

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const POST_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const POST_MEDIA_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function fileToDataUrl(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

async function parsePostMediaFromForm(formData: FormData) {
  const possibleFiles = [formData.get("imageAttachment"), formData.get("cameraAttachment")].filter((value): value is File => value instanceof File && value.size > 0);
  const file = possibleFiles[0] ?? null;
  if (!file) {
    return null;
  }

  if (!POST_MEDIA_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Post images must be JPG, PNG, WEBP, or GIF.");
  }

  if (file.size > POST_MEDIA_MAX_BYTES) {
    throw new Error("Post images must be 5 MB or smaller.");
  }

  return {
    storageKey: await fileToDataUrl(file),
  };
}

const PROFILE_IMAGE_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function validateProfileImageValue(image: string | null) {
  if (!image) {
    return null;
  }

  if (image.startsWith("/avatars/")) {
    return image;
  }

  if (image.startsWith("data:")) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Profile image upload could not be processed.");
    }

    const mimeType = match[1].toLowerCase();
    if (!PROFILE_IMAGE_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error("Profile image must be a JPG, PNG, WEBP, or GIF.");
    }

    const base64Payload = match[2];
    const sizeInBytes = Math.floor((base64Payload.length * 3) / 4);
    if (sizeInBytes > PROFILE_IMAGE_MAX_BYTES) {
      throw new Error("Profile image must be 5 MB or smaller.");
    }

    return image;
  }

  try {
    const parsed = new URL(image);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Profile image must use http or https.");
    }
  } catch {
    throw new Error("Profile image must be a valid URL or uploaded image.");
  }

  return image;
}

function getFirstUploadedFile(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key);
    if (value instanceof File && value.size > 0) {
      return value;
    }
  }

  return null;
}

async function uniqueGroupSlug(name: string) {
  const base = slugify(name) || "group";
  let candidate = base;
  let suffix = 1;

  while (await prisma.group.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

async function requireGroupManager(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      createdByUserId: true,
      memberships: {
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
          role: { in: [GroupRole.MANAGER, GroupRole.OWNER] },
        },
        select: { id: true },
      },
    },
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.createdByUserId !== userId && group.memberships.length === 0) {
    throw new Error("Only group managers can do that.");
  }

  return group;
}

async function createNotification(userId: string, type: NotificationType, payloadJson: Prisma.InputJsonValue, options?: { deliver?: boolean }) {
  const notification = await createNotificationRecord(prisma, userId, type, payloadJson);
  if (options?.deliver) {
    await deliverNotification(notification.id);
  }
  return notification;
}

export async function togglePostReactionAction(formData: FormData) {
  const user = await requireActiveUser();
  const postId = textValue(formData, "postId");
  const groupId = optionalTextValue(formData, "groupId");
  const reactionType = textValue(formData, "reactionType") as ReactionType;

  if (!postId) {
    throw new Error("Post not found.");
  }

  const existingReaction = await prisma.postReaction.findUnique({
    where: {
      postId_userId: {
        postId,
        userId: user.id,
      },
    },
    select: { id: true, reactionType: true },
  });

  if (existingReaction?.reactionType === reactionType) {
    await prisma.postReaction.delete({ where: { id: existingReaction.id } });
  } else if (existingReaction) {
    await prisma.postReaction.update({
      where: { id: existingReaction.id },
      data: { reactionType },
    });
  } else {
    await prisma.postReaction.create({
      data: {
        postId,
        userId: user.id,
        reactionType,
      },
    });
  }

  revalidatePath("/home");
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
  }
}

export async function blockUserAction(formData: FormData) {
  const user = await requireActiveUser();
  const blockedUserId = textValue(formData, "blockedUserId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/home";
  const reason = optionalTextValue(formData, "reason") ?? "Blocked from member post actions";

  if (!blockedUserId || blockedUserId === user.id) {
    throw new Error("Choose another member to block.");
  }

  const pairKey = userPairKey(user.id, blockedUserId);

  await prisma.$transaction(async (tx) => {
    await tx.userBlock.upsert({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: user.id,
          blockedUserId,
        },
      },
      update: { reason },
      create: {
        blockerUserId: user.id,
        blockedUserId,
        reason,
      },
    });

    await invalidatePairInteractionsByBlock(tx, pairKey, user.id, blockedUserId);
    await invalidateBuddyByBlock(tx, user.id, blockedUserId);
  });

  revalidatePath("/home");
  revalidatePath("/chats");
  revalidatePath("/buddy");
  revalidatePath("/notifications");
  revalidatePath(`/users/${blockedUserId}`);
  if (sourcePath !== "/home") {
    revalidatePath(sourcePath);
  }

  const redirectPath = sourcePath.startsWith("/chats/")
    ? "/chats?saved=user-blocked"
    : sourcePath.startsWith("/buddy/")
      ? "/buddy?saved=buddy-blocked"
      : withSavedParam(sourcePath, "user-blocked");

  redirect(redirectPath);
}

export async function reportUserAction(formData: FormData) {
  const user = await requireActiveUser();
  const targetUserId = textValue(formData, "targetUserId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/home";
  const details = optionalTextValue(formData, "details");

  if (!targetUserId || targetUserId === user.id) {
    throw new Error("Choose another member to report.");
  }

  await prisma.report.create({
    data: {
      filedByUserId: user.id,
      targetType: ReportTargetType.USER,
      targetUserId,
      reasonCode: "USER_REPORT",
      details,
    },
  });

  revalidatePath("/notifications");
  if (sourcePath !== "/home") {
    revalidatePath(sourcePath);
  }
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  const displayName = textValue(formData, "displayName");
  if (displayName.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }

  const bio = optionalTextValue(formData, "bio");
  const region = optionalTextValue(formData, "region");
  const r2MediaPipelineEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.r2MediaPipeline, user);
  const uploadedProfileImage = r2MediaPipelineEnabled ? getFirstUploadedFile(formData, ["imageUpload", "imageCameraUpload"]) : null;
  const image = uploadedProfileImage ? null : validateProfileImageValue(optionalTextValue(formData, "image"));
  if (bio && bio.length > 3000) {
    throw new Error("Bio must be 3000 characters or fewer.");
  }
  if (region && region.length > 100) {
    throw new Error("Region must be 100 characters or fewer.");
  }

  const uploadedProfileAsset = uploadedProfileImage
    ? await uploadProfileImageToR2(user.id, uploadedProfileImage)
    : null;

  const interestIds = formData
    .getAll("interestIds")
    .map((value) => String(value))
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        displayName,
        bio,
        region,
        image,
      },
    });

    if (uploadedProfileAsset) {
      await tx.userProfileImageAsset.create({
        data: {
          userId: user.id,
          objectKey: uploadedProfileAsset.objectKey,
          storageProvider: uploadedProfileAsset.storageProvider,
          mimeType: uploadedProfileAsset.mimeType,
          moderationStatus: uploadedProfileAsset.moderationStatus,
          uploadedAt: uploadedProfileAsset.uploadedAt,
        },
      });
    }

    await tx.userInterest.deleteMany({ where: { userId: user.id } });

    if (interestIds.length > 0) {
      await tx.userInterest.createMany({
        data: interestIds.map((interestId) => ({ userId: user.id, interestId })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/me");
  revalidatePath(`/users/${user.id}`);
  redirect(`/me?saved=${uploadedProfileAsset ? "profile-image-pending" : "profile"}`);
}

export async function updatePrivacyAction(formData: FormData) {
  const user = await requireUser();

  const profileVisibility = textValue(formData, "profileVisibility") as ProfileVisibility;
  const chatRequestPolicy = textValue(formData, "chatRequestPolicy") as ChatRequestPolicy;
  const photoRequestPolicy = textValue(formData, "photoRequestPolicy") as PhotoRequestPolicy;
  const activityVisibility = textValue(formData, "activityVisibility") as ActivityVisibility;
  const verifiedBadgeVisible = formData.get("verifiedBadgeVisible") === "on";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      profileVisibility,
      chatRequestPolicy,
      photoRequestPolicy,
      activityVisibility,
      verifiedBadgeVisible,
    },
  });

  revalidatePath("/me");
  revalidatePath(`/users/${user.id}`);
  redirect("/settings?saved=privacy");
}

export async function submitVerificationRequestAction() {
  const user = await requireUser();

  const existingPending = await prisma.verificationRequest.findFirst({
    where: { userId: user.id, status: VerificationStatus.PENDING },
    select: { id: true },
  });

  if (!existingPending && user.verificationStatus !== VerificationStatus.APPROVED) {
    await prisma.$transaction([
      prisma.verificationRequest.create({
        data: {
          userId: user.id,
          status: VerificationStatus.PENDING,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { verificationStatus: VerificationStatus.PENDING },
      }),
    ]);
  }

  revalidatePath("/me");
  revalidatePath(`/users/${user.id}`);
  redirect("/settings?saved=verification");
}

export async function addProfileMediaAction(formData: FormData) {
  const user = await requireUser();
  const storageKey = textValue(formData, "storageKey");
  if (!storageKey) {
    throw new Error("Media URL or storage key is required.");
  }

  const mediaType = textValue(formData, "mediaType") as MediaType;
  const visibilityLevel = textValue(formData, "visibilityLevel") as MediaVisibilityLevel;

  const currentMax = await prisma.userProfileMedia.aggregate({
    where: { userId: user.id, mediaType },
    _max: { sortOrder: true },
  });

  await prisma.userProfileMedia.create({
    data: {
      userId: user.id,
      mediaType,
      storageKey,
      visibilityLevel,
      sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/me");
  revalidatePath(`/users/${user.id}`);
  redirect("/me?saved=media");
}

export async function deleteProfileMediaAction(formData: FormData) {
  const user = await requireUser();
  const mediaId = textValue(formData, "mediaId");

  await prisma.userProfileMedia.deleteMany({
    where: {
      id: mediaId,
      userId: user.id,
    },
  });

  revalidatePath("/me");
  revalidatePath(`/users/${user.id}`);
  redirect("/me?saved=media");
}

export async function createPostAction(formData: FormData) {
  const user = await requireUser();
  const contentText = textValue(formData, "contentText");
  if (contentText.length < 2) {
    throw new Error("Post text must be at least 2 characters.");
  }

  const groupId = textValue(formData, "groupId");
  const isSensitive = formData.get("isSensitive") === "on";
  const uploadedMedia = await parsePostMediaFromForm(formData);
  let contextType: PostContextType = PostContextType.GLOBAL_FEED;
  let isAnonymous = formData.get("isAnonymous") === "on";

  if (groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        groupType: true,
        isSmallPrivateGroup: true,
        status: true,
        createdByUserId: true,
        memberships: {
          where: { userId: user.id, status: MembershipStatus.ACTIVE },
          select: { id: true },
        },
      },
    });

    if (!group || group.status !== GroupStatus.ACTIVE) {
      throw new Error("Group not found.");
    }

    const canPost = group.createdByUserId === user.id || group.memberships.length > 0;
    if (!canPost) {
      throw new Error("Join the group before posting.");
    }

    if (group.isSmallPrivateGroup || group.groupType !== GroupType.OPEN) {
      isAnonymous = false;
    }

    contextType = PostContextType.GROUP;
  }

  await prisma.post.create({
    data: {
      authorUserId: user.id,
      contextType,
      groupId: groupId || null,
      contentText,
      isAnonymous,
      sensitivityStatus: isSensitive ? PostSensitivityStatus.SELF_MARKED_SENSITIVE : PostSensitivityStatus.NORMAL,
      media: uploadedMedia
        ? {
            create: {
              storageKey: uploadedMedia.storageKey,
            },
          }
        : undefined,
    },
  });

  revalidatePath("/home");
  revalidatePath("/groups");
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
  }
}

export async function createCommentAction(formData: FormData) {
  const user = await requireUser();
  const postId = textValue(formData, "postId");
  const contentText = textValue(formData, "contentText");

  if (contentText.length < 1) {
    throw new Error("Comment text is required.");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      groupId: true,
      authorUserId: true,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  await prisma.comment.create({
    data: {
      postId,
      authorUserId: user.id,
      contentText,
    },
  });

  if (post.authorUserId !== user.id) {
    await createNotification(post.authorUserId, NotificationType.COMMENT_RECEIVED, {
      actorUserId: user.id,
      actorDisplayName: user.displayName,
      postId,
      groupId: post.groupId,
      contentPreview: contentText.slice(0, 120),
    });
  }

  revalidatePath("/home");
  if (post.groupId) {
    revalidatePath(`/groups/${post.groupId}`);
  }
  revalidatePath("/notifications");
}

export async function createGroupAction(formData: FormData) {
  const user = await requireUser();
  const name = textValue(formData, "name");
  if (name.length < 3) {
    throw new Error("Group name must be at least 3 characters.");
  }

  const description = optionalTextValue(formData, "description");
  const groupType = textValue(formData, "groupType") as GroupType;
  const isSmallPrivateGroup = formData.get("isSmallPrivateGroup") === "on";
  const slug = await uniqueGroupSlug(name);

  const group = await prisma.group.create({
    data: {
      name,
      slug,
      description,
      groupType,
      isSmallPrivateGroup,
      createdByUserId: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: GroupRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/groups");
  revalidatePath("/home");
  revalidatePath(`/groups/${group.id}`);
}

export async function updateGroupAction(formData: FormData) {
  const user = await requireUser();
  const groupId = textValue(formData, "groupId");
  const name = textValue(formData, "name");
  const description = optionalTextValue(formData, "description");

  if (name.length < 3) {
    throw new Error("Group name must be at least 3 characters.");
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, createdByUserId: true },
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.createdByUserId !== user.id) {
    throw new Error("Only the group owner can edit this group.");
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { name, description },
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
}

export async function removeGroupMemberAction(formData: FormData) {
  const user = await requireUser();
  const groupId = textValue(formData, "groupId");
  const memberUserId = textValue(formData, "memberUserId");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, createdByUserId: true },
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.createdByUserId !== user.id) {
    throw new Error("Only the group owner can remove members.");
  }

  if (memberUserId === user.id) {
    throw new Error("The owner cannot remove themselves.");
  }

  await prisma.groupMembership.deleteMany({
    where: {
      groupId,
      userId: memberUserId,
      status: MembershipStatus.ACTIVE,
    },
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
}

export async function joinGroupAction(formData: FormData) {
  const user = await requireUser();
  const groupId = textValue(formData, "groupId");
  const requestMessage = optionalTextValue(formData, "requestMessage");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      groupType: true,
      status: true,
    },
  });

  if (!group || group.status !== GroupStatus.ACTIVE) {
    throw new Error("Group not found.");
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    select: { id: true, status: true },
  });

  if (membership?.status === MembershipStatus.ACTIVE) {
    return;
  }

  if (group.groupType === GroupType.OPEN) {
    await prisma.groupMembership.upsert({
      where: { groupId_userId: { groupId, userId: user.id } },
      update: { status: MembershipStatus.ACTIVE, role: GroupRole.MEMBER },
      create: {
        groupId,
        userId: user.id,
        role: GroupRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
  } else {
    const pairKey = `${groupId}:${user.id}`;
    const pendingRequest = await prisma.groupJoinRequest.findFirst({
      where: { groupId, applicantUserId: user.id, status: GroupJoinRequestStatus.PENDING },
      select: { id: true },
    });

    if (!pendingRequest) {
      await prisma.groupJoinRequest.create({
        data: {
          groupId,
          applicantUserId: user.id,
          pairKey,
          pendingKey: pairKey,
          requestMessage,
        },
      });
    }
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");
}

export async function reviewGroupJoinRequestAction(formData: FormData) {
  const manager = await requireUser();
  const joinRequestId = textValue(formData, "joinRequestId");
  const decision = textValue(formData, "decision");

  const joinRequest = await prisma.groupJoinRequest.findUnique({
    where: { id: joinRequestId },
    select: {
      id: true,
      groupId: true,
      applicantUserId: true,
      status: true,
      group: { select: { name: true } },
    },
  });

  if (!joinRequest || joinRequest.status !== GroupJoinRequestStatus.PENDING) {
    throw new Error("Join request not found.");
  }

  await requireGroupManager(joinRequest.groupId, manager.id);

  if (decision === "approve") {
    await prisma.$transaction([
      prisma.groupJoinRequest.update({
        where: { id: joinRequest.id },
        data: {
          status: GroupJoinRequestStatus.APPROVED,
          pendingKey: null,
          reviewedByUserId: manager.id,
          reviewedAt: new Date(),
        },
      }),
      prisma.groupMembership.upsert({
        where: { groupId_userId: { groupId: joinRequest.groupId, userId: joinRequest.applicantUserId } },
        update: { status: MembershipStatus.ACTIVE, role: GroupRole.MEMBER },
        create: {
          groupId: joinRequest.groupId,
          userId: joinRequest.applicantUserId,
          role: GroupRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);

    await createNotification(joinRequest.applicantUserId, NotificationType.GROUP_JOIN_APPROVED, {
      groupId: joinRequest.groupId,
      groupName: joinRequest.group.name,
    });
  } else {
    await prisma.groupJoinRequest.update({
      where: { id: joinRequest.id },
      data: {
        status: GroupJoinRequestStatus.REJECTED,
        pendingKey: null,
        reviewedByUserId: manager.id,
        reviewedAt: new Date(),
      },
    });
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${joinRequest.groupId}`);
  revalidatePath("/notifications");
}

export async function sendChatRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const targetUserId = textValue(formData, "targetUserId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/home";

  if (!targetUserId || targetUserId === user.id) {
    throw new Error("Choose another member to contact.");
  }

  const pairKey = userPairKey(user.id, targetUserId);

  const [targetUser, existingBlock, existingConversation, existingPendingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        displayName: true,
        chatRequestPolicy: true,
        profileVisibility: true,
      },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: user.id, blockedUserId: targetUserId },
          { blockerUserId: targetUserId, blockedUserId: user.id },
        ],
      },
      select: { id: true },
    }),
    prisma.conversation.findUnique({
      where: { pairKey },
      select: { id: true, status: true },
    }),
    prisma.chatRequest.findFirst({
      where: {
        pairKey,
        status: ChatRequestStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, fromUserId: true, toUserId: true },
    }),
  ]);

  if (!targetUser) {
    throw new Error("Member not available.");
  }

  if (existingBlock) {
    throw new Error("Chat requests are not available for this member.");
  }

  if (!hasMinimalProfileVisibility(targetUser.profileVisibility)) {
    throw new Error("You need minimal visibility into this profile before sending a chat request.");
  }

  if (targetUser.chatRequestPolicy === ChatRequestPolicy.NOBODY) {
    throw new Error("This member is not accepting chat requests right now.");
  }

  if (targetUser.chatRequestPolicy === ChatRequestPolicy.VERIFIED_ONLY && !isFullyVerifiedUser(user)) {
    throw new Error("Only fully verified members can send chat requests to this profile.");
  }

  if (existingPendingRequest) {
    const destination = existingPendingRequest.toUserId === user.id ? withSavedParam("/chats", "incoming-chat") : withSavedParam(sourcePath, "chat-request");
    redirect(destination);
  }

  if (existingConversation?.status === ConversationStatus.ACTIVE) {
    redirect(`/chats/${existingConversation.id}`);
  }

  if (existingConversation?.status === ConversationStatus.BLOCKED) {
    throw new Error("Chat requests are not available for this member.");
  }

  const singleOfWeekEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.singleOfWeek, user);
  const activeFeature = singleOfWeekEnabled ? await syncSingleOfWeekState() : null;
  const targetFeaturedFeature = activeFeature?.featuredUserId === targetUserId && activeFeature.status === "ACTIVE" ? activeFeature : null;

  if (targetFeaturedFeature) {
    const singleOfWeekCapState = await canCreateSingleOfWeekRequest(targetFeaturedFeature.id, user.id);
    if (singleOfWeekCapState.blocked) {
      throw new Error(singleOfWeekCapState.reason ?? "This featured member has reached the maximum number of requests.");
    }
  }

  await prisma.chatRequest.create({
    data: {
      fromUserId: user.id,
      toUserId: targetUserId,
      pairKey,
      pendingKey: pairKey,
      singleOfWeekFeatureId: targetFeaturedFeature?.id ?? null,
    },
  });

  await createNotification(targetUserId, NotificationType.CHAT_REQUEST_INCOMING, {
    fromUserId: user.id,
    fromDisplayName: user.displayName,
  }, { deliver: true });

  revalidatePath(`/users/${targetUserId}`);
  revalidatePath("/chats");
  revalidatePath("/notifications");
  redirect(withSavedParam(sourcePath, "chat-request"));
}
export async function reviewChatRequestAction(formData: FormData) {
  const user = await requireUser();
  const chatRequestId = textValue(formData, "chatRequestId");
  const decision = textValue(formData, "decision");
  const redirectToConversation = textValue(formData, "redirectToConversation") === "true";

  const request = await prisma.chatRequest.findUnique({
    where: { id: chatRequestId },
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      status: true,
      fromUser: { select: { displayName: true } },
    },
  });

  if (!request || request.toUserId !== user.id || request.status !== ChatRequestStatus.PENDING) {
    throw new Error("Chat request not found.");
  }

  const pairKey = userPairKey(request.fromUserId, request.toUserId);

  if (decision === "accept") {
    const existingConversation = await prisma.conversation.findUnique({
      where: { pairKey },
      select: { id: true, status: true },
    });

    let conversationId = existingConversation?.id ?? null;

    await prisma.chatRequest.update({
      where: { id: request.id },
      data: {
        status: ChatRequestStatus.ACCEPTED,
        pendingKey: null,
        respondedAt: new Date(),
      },
    });

    if (!existingConversation) {
      const conversation = await prisma.conversation.create({
        data: {
          userOneId: [request.fromUserId, request.toUserId].sort()[0],
          userTwoId: [request.fromUserId, request.toUserId].sort()[1],
          pairKey,
          status: ConversationStatus.ACTIVE,
          createdFromChatRequestId: request.id,
        },
        select: { id: true },
      });

      conversationId = conversation.id;
    } else if (existingConversation.status !== ConversationStatus.ACTIVE) {
      await prisma.conversation.update({
        where: { id: existingConversation.id },
        data: { status: ConversationStatus.ACTIVE },
      });
    }

    await createNotification(request.fromUserId, NotificationType.CHAT_REQUEST_ACCEPTED, {
      byUserId: user.id,
      byDisplayName: user.displayName,
    });

    revalidatePath("/chats");
    revalidatePath("/notifications");
    revalidatePath(`/users/${request.fromUserId}`);

    if (redirectToConversation && conversationId) {
      redirect(`/chats/${conversationId}`);
    }
  } else {
    await prisma.chatRequest.update({
      where: { id: request.id },
      data: {
        status: ChatRequestStatus.REJECTED,
        pendingKey: null,
        respondedAt: new Date(),
      },
    });
  }

  revalidatePath("/chats");
  revalidatePath("/notifications");
  revalidatePath(`/users/${request.fromUserId}`);
}

export async function requestVideoConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const targetUserId = textValue(formData, "targetUserId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/chats";

  if (!targetUserId || targetUserId === user.id) {
    throw new Error("Choose another member to request video access from.");
  }

  const pairKey = userPairKey(user.id, targetUserId);

  const [conversation, existingBlock, existingVideoConsent] = await Promise.all([
    prisma.conversation.findUnique({
      where: { pairKey },
      select: { id: true, status: true },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: user.id, blockedUserId: targetUserId },
          { blockerUserId: targetUserId, blockedUserId: user.id },
        ],
      },
      select: { id: true },
    }),
    prisma.videoConsent.findUnique({
      where: { pairKey },
      select: { id: true, status: true, targetUserId: true, requesterUserId: true },
    }),
  ]);

  if (!conversation || conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("Video requests require an active approved chat first.");
  }

  if (existingBlock) {
    throw new Error("Video requests are not available for this member.");
  }

  if (existingVideoConsent?.status === ConsentStatus.APPROVED) {
    redirect(`/chats/${conversation.id}`);
  }

  if (existingVideoConsent?.status === ConsentStatus.PENDING) {
    redirect(withSavedParam(sourcePath, "video-request"));
  }

  await prisma.videoConsent.upsert({
    where: { pairKey },
    update: {
      requesterUserId: user.id,
      targetUserId,
      approvedByUserId: null,
      status: ConsentStatus.PENDING,
      respondedAt: null,
    },
    create: {
      pairKey,
      requesterUserId: user.id,
      targetUserId,
      status: ConsentStatus.PENDING,
    },
  });

  await createNotification(targetUserId, NotificationType.VIDEO_REQUEST_INCOMING, {
    requesterUserId: user.id,
    requesterDisplayName: user.displayName,
  });

  revalidatePath("/chats");
  revalidatePath(`/users/${targetUserId}`);
  revalidatePath("/notifications");
  redirect(withSavedParam(sourcePath, "video-request"));
}

export async function reviewVideoConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const consentId = textValue(formData, "consentId");
  const decision = textValue(formData, "decision");

  const consent = await prisma.videoConsent.findUnique({
    where: { id: consentId },
    select: {
      id: true,
      pairKey: true,
      requesterUserId: true,
      targetUserId: true,
      status: true,
    },
  });

  if (!consent || consent.targetUserId !== user.id || consent.status !== ConsentStatus.PENDING) {
    throw new Error("Video request not found.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { pairKey: consent.pairKey },
    select: { id: true, status: true },
  });

  if (!conversation || conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("Video approval requires an active approved chat.");
  }

  const nextStatus = decision === "approve" ? ConsentStatus.APPROVED : ConsentStatus.DECLINED;
  await prisma.videoConsent.update({
    where: { id: consent.id },
    data: {
      status: nextStatus,
      approvedByUserId: decision === "approve" ? user.id : null,
      respondedAt: new Date(),
    },
  });

  if (nextStatus === ConsentStatus.APPROVED) {
    await createNotification(consent.requesterUserId, NotificationType.VIDEO_REQUEST_APPROVED, {
      approverUserId: user.id,
      approverDisplayName: user.displayName,
      conversationId: conversation.id,
    }, { deliver: true });
  }

  revalidatePath("/chats");
  revalidatePath(`/chats/${conversation.id}`);
  revalidatePath("/notifications");
}

export async function revokeChatConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const conversationId = textValue(formData, "conversationId");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      pairKey: true,
      userOneId: true,
      userTwoId: true,
      status: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant || conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("This chat cannot be revoked.");
  }

  await prisma.$transaction(async (tx) => {
    await revokeChatConversationByPair(tx, conversation.pairKey, ConversationStatus.CLOSED, user.id);
  });

  revalidatePath("/chats");
  redirect(withSavedParam("/chats", "chat-revoked"));
}

export async function revokeVideoConsentAction(formData: FormData) {
  const user = await requireActiveUser();
  const pairKey = textValue(formData, "pairKey");
  const conversationId = optionalTextValue(formData, "conversationId");

  const conversation = await prisma.conversation.findUnique({
    where: { pairKey },
    select: { id: true, userOneId: true, userTwoId: true },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant) {
    throw new Error("This video consent cannot be changed.");
  }

  await prisma.$transaction(async (tx) => {
    await revokeVideoConsentForPair(tx, pairKey, user.id);
    await tx.videoCallRecord.updateMany({
      where: { conversationId: conversation.id, endedAt: null },
      data: {
        endedAt: new Date(),
        activeConversationKey: null,
      },
    });
  });

  revalidatePath("/chats");
  if (conversationId) {
    revalidatePath(`/chats/${conversationId}`);
  }
}

export async function sendPhotoAccessRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const ownerUserId = textValue(formData, "ownerUserId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/home";

  if (!ownerUserId || ownerUserId === user.id) {
    throw new Error("Choose another member to request access from.");
  }

  if (!isFullyVerifiedUser(user)) {
    throw new Error("Only fully verified members can request access to approved gallery media.");
  }

  const pairKey = userPairKey(user.id, ownerUserId);

  const [owner, existingBlock, existingPendingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        displayName: true,
        photoRequestPolicy: true,
      },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: user.id, blockedUserId: ownerUserId },
          { blockerUserId: ownerUserId, blockedUserId: user.id },
        ],
      },
      select: { id: true },
    }),
    prisma.photoAccessRequest.findFirst({
      where: {
        pairKey,
        status: PhotoAccessRequestStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  if (!owner) {
    throw new Error("Member not available.");
  }

  if (existingBlock) {
    throw new Error("Photo access requests are not available for this member.");
  }

  if (owner.photoRequestPolicy === PhotoRequestPolicy.NOBODY) {
    throw new Error("This member is not accepting photo access requests.");
  }

  if (existingPendingRequest) {
    redirect(withSavedParam(sourcePath, "photo-request"));
  }

  await prisma.photoAccessRequest.create({
    data: {
      requesterUserId: user.id,
      ownerUserId,
      pairKey,
      pendingKey: pairKey,
    },
  });

  await createNotification(ownerUserId, NotificationType.PHOTO_ACCESS_REQUEST_INCOMING, {
    requesterUserId: user.id,
    requesterDisplayName: user.displayName,
  });

  revalidatePath(`/users/${ownerUserId}`);
  revalidatePath("/me");
  revalidatePath("/notifications");
  redirect(withSavedParam(sourcePath, "photo-request"));
}
export async function reviewPhotoAccessRequestAction(formData: FormData) {
  const user = await requireUser();
  const requestId = textValue(formData, "requestId");
  const decision = textValue(formData, "decision");

  const request = await prisma.photoAccessRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requesterUserId: true,
      ownerUserId: true,
      status: true,
    },
  });

  if (!request || request.ownerUserId !== user.id || request.status !== PhotoAccessRequestStatus.PENDING) {
    throw new Error("Photo access request not found.");
  }

  if (decision === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.photoAccessRequest.update({
        where: { id: request.id },
        data: {
          status: PhotoAccessRequestStatus.APPROVED,
          pendingKey: null,
          respondedAt: new Date(),
        },
      });

      const existingGrant = await tx.photoAccessGrant.findUnique({
        where: { ownerUserId_granteeUserId: { ownerUserId: request.ownerUserId, granteeUserId: request.requesterUserId } },
        select: { id: true },
      });

      if (existingGrant) {
        await tx.photoAccessGrant.update({
          where: { id: existingGrant.id },
          data: {
            requestId: request.id,
            revokedAt: null,
            grantedAt: new Date(),
          },
        });
      } else {
        await tx.photoAccessGrant.create({
          data: {
            requestId: request.id,
            ownerUserId: request.ownerUserId,
            granteeUserId: request.requesterUserId,
          },
        });
      }
    });

    await createNotification(request.requesterUserId, NotificationType.PHOTO_ACCESS_APPROVED, {
      ownerUserId: user.id,
      ownerDisplayName: user.displayName,
    });
  } else {
    await prisma.photoAccessRequest.update({
      where: { id: request.id },
      data: {
        status: PhotoAccessRequestStatus.REJECTED,
        pendingKey: null,
        respondedAt: new Date(),
      },
    });
  }

  revalidatePath("/me");
  revalidatePath(`/users/${request.ownerUserId}`);
  revalidatePath(`/users/${request.requesterUserId}`);
  revalidatePath("/notifications");
  redirect("/settings?saved=photo-review");
}

export async function revokePhotoAccessGrantAction(formData: FormData) {
  const user = await requireActiveUser();
  const grantId = textValue(formData, "grantId");

  const grant = await prisma.photoAccessGrant.findUnique({
    where: { id: grantId },
    select: { id: true, ownerUserId: true, granteeUserId: true },
  });

  if (!grant || grant.ownerUserId !== user.id) {
    throw new Error("Photo access grant not found.");
  }

  await prisma.photoAccessGrant.update({
    where: { id: grant.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings");
  revalidatePath(`/users/${grant.granteeUserId}`);
  redirect("/settings?saved=photo-revoked");
}

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();
  const conversationId = textValue(formData, "conversationId");
  const body = textValue(formData, "body");

  if (body.length < 1) {
    throw new Error("Message text is required.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userOneId: true,
      userTwoId: true,
      status: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const isParticipant = conversation.userOneId === user.id || conversation.userTwoId === user.id;
  if (!isParticipant || conversation.status !== ConversationStatus.ACTIVE) {
    throw new Error("You cannot post in this conversation.");
  }

  await prisma.message.create({
    data: {
      conversationId,
      senderUserId: user.id,
      body,
    },
  });

  revalidatePath("/chats");
  revalidatePath(`/chats/${conversationId}`);
}

async function updateNotificationsReadState(userId: string, notificationIds: string[] | null, isRead: boolean) {
  const where = notificationIds && notificationIds.length > 0
    ? { userId, id: { in: notificationIds } }
    : { userId };

  await prisma.notification.updateMany({
    where,
    data: {
      isRead,
      readAt: isRead ? new Date() : null,
    },
  });

  revalidatePath("/notifications");
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = textValue(formData, "notificationId");
  await updateNotificationsReadState(user.id, [notificationId], true);
}

export async function updateSelectedNotificationsReadStateAction(formData: FormData) {
  const user = await requireUser();
  const notificationIds = formData.getAll("notificationIds").map((value) => String(value)).filter(Boolean);
  const nextState = textValue(formData, "nextState");

  if (notificationIds.length === 0) {
    redirect("/notifications?saved=select-notifications");
  }

  await updateNotificationsReadState(user.id, notificationIds, nextState === "read");
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await updateNotificationsReadState(user.id, null, true);
}

export async function markAllNotificationsUnreadAction() {
  const user = await requireUser();
  await updateNotificationsReadState(user.id, null, false);
}















export async function updateNotificationPreferencesAction(formData: FormData) {
  const user = await requireUser();
  const emailActivityEnabled = formData.get("emailActivityEnabled") === "on";
  const silentModeEnabled = formData.get("silentModeEnabled") === "on";
  const hideLockScreenTextEnabled = formData.get("hideLockScreenTextEnabled") === "on";

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { emailActivityEnabled, silentModeEnabled, hideLockScreenTextEnabled },
    create: { userId: user.id, emailActivityEnabled, silentModeEnabled, hideLockScreenTextEnabled },
  });

  revalidatePath("/settings");
  revalidatePath("/notifications");
  redirect("/settings?saved=notifications");
}





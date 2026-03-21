"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ChatRequestOriginType, ChatRequestPolicy, ChatRequestStatus, ConversationStatus, SingleOfWeekApplicationStatus, SingleOfWeekFeatureStatus } from "@prisma/client";
import { hasMinimalProfileVisibility, requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { createNotificationWithDelivery } from "@/lib/notifications";
import {
  SINGLE_OF_WEEK_BIO_MAX,
  SINGLE_OF_WEEK_MAX_PHOTOS,
  SINGLE_OF_WEEK_TEXT_MAX,
  canApplyForSingleOfWeek,
  canCreateSingleOfWeekRequest,
  getEditWindowDeadline,
  hasPairBlock,
  isTrustedSingleOfWeekRequester,
} from "@/lib/single-of-the-week";
import { userPairKey } from "@/lib/interaction-consent";

const PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalTextValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

async function fileToDataUrl(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

async function parsePhotos(formData: FormData) {
  const result: { storageKey: string; sortOrder: number }[] = [];
  for (let index = 0; index < SINGLE_OF_WEEK_MAX_PHOTOS; index += 1) {
    const file = formData.get(`photo-${index}`);
    if (!(file instanceof File) || file.size === 0) {
      continue;
    }
    if (!PHOTO_ALLOWED_TYPES.has(file.type)) {
      throw new Error("Single of the Week photos must be JPG, PNG, WEBP, or GIF.");
    }
    if (file.size > PHOTO_MAX_BYTES) {
      throw new Error("Single of the Week photos must be 5 MB or smaller.");
    }
    result.push({ storageKey: await fileToDataUrl(file), sortOrder: index });
  }
  return result;
}

function validateLength(value: string | null, max: number, label: string) {
  if (value && value.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
}

function revalidateSinglePaths() {
  revalidatePath("/home");
  revalidatePath("/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/single-of-the-week");
}

export async function submitSingleOfWeekApplicationAction(formData: FormData) {
  const user = await requireActiveUser();
  const eligibility = await canApplyForSingleOfWeek(prisma, user.id);
  if (!eligibility.allowed) {
    throw new Error(eligibility.reason ?? "You cannot apply for Single of the Week right now.");
  }

  const bio = textValue(formData, "bio");
  const interests = optionalTextValue(formData, "interests");
  const hobbies = optionalTextValue(formData, "hobbies");
  const relationshipIntent = optionalTextValue(formData, "relationshipIntent");
  const preferredLocation = optionalTextValue(formData, "preferredLocation");
  const consented = formData.get("consented") === "on";
  const photos = await parsePhotos(formData);

  if (bio.length == 0 || bio.length > SINGLE_OF_WEEK_BIO_MAX) {
    throw new Error(`Bio must be between 1 and ${SINGLE_OF_WEEK_BIO_MAX} characters.`);
  }

  validateLength(interests, SINGLE_OF_WEEK_TEXT_MAX, "Interests");
  validateLength(hobbies, SINGLE_OF_WEEK_TEXT_MAX, "Hobbies");
  validateLength(relationshipIntent, SINGLE_OF_WEEK_TEXT_MAX, "Relationship intent");
  validateLength(preferredLocation, SINGLE_OF_WEEK_TEXT_MAX, "Preferred location");

  if (!consented) {
    throw new Error("Consent is required before submitting this application.");
  }

  const existing = await prisma.singleOfWeekApplication.findFirst({
    where: {
      applicantUserId: user.id,
      status: { in: [SingleOfWeekApplicationStatus.SUBMITTED, SingleOfWeekApplicationStatus.SHORTLISTED, SingleOfWeekApplicationStatus.SELECTED] },
    },
    orderBy: { submittedAt: "desc" },
    include: { features: { where: { status: { in: [SingleOfWeekFeatureStatus.UPCOMING, SingleOfWeekFeatureStatus.AWAITING_RESPONSE, SingleOfWeekFeatureStatus.ACTIVE] } }, orderBy: { publishAt: "asc" }, take: 1 } },
  });

  if (photos.length === 0 && !existing?.id) {
    throw new Error("Add at least one photo to the featured profile snapshot.");
  }

  if (existing?.features[0]) {
    const deadline = getEditWindowDeadline(existing.features[0].weekOf);
    if (new Date() >= deadline) {
      throw new Error("This featured application is locked because the selection window is closing.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const data = {
      bio,
      interests,
      hobbies,
      relationshipIntent,
      preferredLocation,
      consentedAt: new Date(),
      status: existing?.status === SingleOfWeekApplicationStatus.SELECTED ? SingleOfWeekApplicationStatus.SELECTED : SingleOfWeekApplicationStatus.SUBMITTED,
      shortlistedAt: existing?.shortlistedAt ?? null,
      selectedAt: existing?.selectedAt ?? null,
      rejectedAt: null,
      withdrawnAt: null,
    };

    const application = existing
      ? await tx.singleOfWeekApplication.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.singleOfWeekApplication.create({ data: { applicantUserId: user.id, ...data }, select: { id: true } });

    if (photos.length > 0) {
      await tx.singleOfWeekApplicationPhoto.deleteMany({ where: { applicationId: application.id } });
      await tx.singleOfWeekApplicationPhoto.createMany({
        data: photos.map((photo) => ({ applicationId: application.id, storageKey: photo.storageKey, sortOrder: photo.sortOrder })),
      });
    }
  });

  revalidateSinglePaths();
  redirect("/single-of-the-week?saved=application");
}

export async function respondToSingleOfWeekSelectionAction(formData: FormData) {
  const user = await requireActiveUser();
  const featureId = textValue(formData, "featureId");
  const decision = textValue(formData, "decision");

  if (!["accept", "decline"].includes(decision)) {
    throw new Error("Choose accept or decline.");
  }

  await prisma.$transaction(async (tx) => {
    const feature = await tx.singleOfWeekFeature.findUnique({
      where: { id: featureId },
      include: { application: true },
    });

    if (!feature || feature.application.applicantUserId !== user.id) {
      throw new Error("Featured selection not found.");
    }

    if (feature.status !== SingleOfWeekFeatureStatus.AWAITING_RESPONSE && feature.status !== SingleOfWeekFeatureStatus.UPCOMING) {
      throw new Error("This featured selection can no longer be updated.");
    }

    await tx.singleOfWeekFeature.update({
      where: { id: feature.id },
      data: decision === "accept"
        ? {
            status: feature.publishAt <= new Date() ? SingleOfWeekFeatureStatus.ACTIVE : SingleOfWeekFeatureStatus.UPCOMING,
            respondedByUserId: user.id,
            acceptedAt: new Date(),
          }
        : {
            status: SingleOfWeekFeatureStatus.DECLINED,
            respondedByUserId: user.id,
            declinedAt: new Date(),
          },
    });
  });

  revalidateSinglePaths();
  redirect("/single-of-the-week?saved=response");
}

export async function sendSingleOfWeekChatRequestAction(formData: FormData) {
  const user = await requireActiveUser();
  const featureId = textValue(formData, "featureId");
  const sourcePath = optionalTextValue(formData, "sourcePath") ?? "/home";

  const feature = await prisma.singleOfWeekFeature.findUnique({
    where: { id: featureId },
    include: {
      application: { include: { applicant: true } },
      requestLimitOverride: true,
    },
  });

  if (!feature || feature.status !== SingleOfWeekFeatureStatus.ACTIVE) {
    throw new Error("That featured member is not available right now.");
  }

  if (feature.featuredUserId === user.id) {
    throw new Error("You cannot send a featured request to yourself.");
  }

  if (!(await isTrustedSingleOfWeekRequester(prisma, user.id, feature.featuredUserId))) {
    throw new Error("Only trusted verified members can send requests to the featured member.");
  }

  const capState = await canCreateSingleOfWeekRequest(feature.id, user.id);
  if (capState.blocked) {
    throw new Error(capState.reason ?? "This featured member has reached the maximum number of requests.");
  }

  const pairKey = userPairKey(user.id, feature.featuredUserId);
  const [targetUser, existingConversation, existingPendingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { id: feature.featuredUserId },
      select: { id: true, displayName: true, chatRequestPolicy: true, profileVisibility: true },
    }),
    prisma.conversation.findUnique({ where: { pairKey }, select: { id: true, status: true } }),
    prisma.chatRequest.findFirst({
      where: { pairKey, status: ChatRequestStatus.PENDING },
      orderBy: { createdAt: "desc" },
      select: { id: true, fromUserId: true, toUserId: true },
    }),
  ]);

  if (!targetUser) {
    throw new Error("Member not available.");
  }

  if (await hasPairBlock(prisma, user.id, feature.featuredUserId)) {
    throw new Error("Chat requests are not available for this member.");
  }

  if (!hasMinimalProfileVisibility(targetUser.profileVisibility)) {
    throw new Error("You need minimal visibility into this profile before sending a chat request.");
  }

  if (targetUser.chatRequestPolicy === ChatRequestPolicy.NOBODY) {
    throw new Error("This member is not accepting chat requests right now.");
  }

  if (existingPendingRequest) {
    redirect(existingPendingRequest.toUserId === user.id ? "/chats?saved=incoming-chat" : `${sourcePath}?saved=featured-chat-request`);
  }

  if (existingConversation?.status === ConversationStatus.ACTIVE) {
    redirect(`/chats/${existingConversation.id}`);
  }

  if (existingConversation?.status === ConversationStatus.BLOCKED) {
    throw new Error("Chat requests are not available for this member.");
  }

  await prisma.chatRequest.create({
    data: {
      fromUserId: user.id,
      toUserId: feature.featuredUserId,
      pairKey,
      pendingKey: pairKey,
      originType: ChatRequestOriginType.SINGLE_OF_WEEK,
      singleOfWeekFeatureId: feature.id,
    },
  });

  await createNotificationWithDelivery(feature.featuredUserId, "CHAT_REQUEST_INCOMING", {
    fromUserId: user.id,
    fromDisplayName: user.displayName,
    featureId: feature.id,
    path: "/chats",
  });

  revalidatePath("/home");
  revalidatePath("/chats");
  revalidatePath("/notifications");
  revalidatePath("/admin/single-of-the-week");
  redirect(`${sourcePath}?saved=featured-chat-request`);
}

export async function withdrawSingleOfWeekApplicationAction(formData: FormData) {
  const user = await requireActiveUser();
  const applicationId = textValue(formData, "applicationId");

  await prisma.singleOfWeekApplication.updateMany({
    where: { id: applicationId, applicantUserId: user.id, status: { in: [SingleOfWeekApplicationStatus.SUBMITTED, SingleOfWeekApplicationStatus.SHORTLISTED] } },
    data: {
      status: SingleOfWeekApplicationStatus.WITHDRAWN,
      withdrawnAt: new Date(),
    },
  });

  revalidateSinglePaths();
  redirect("/single-of-the-week?saved=withdrawn");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MediaModerationStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { needsMediaModerationReview } from "@/lib/media-moderation";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectBack(type: string, status: string, priority: string, stale: string, returnTo?: string) {
  if (returnTo === "action-center") {
    redirect("/admin?saved=media-moderation");
  }
  redirect(`/admin/media?saved=media-moderation&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}&priority=${encodeURIComponent(priority)}&stale=${encodeURIComponent(stale)}`);
}

function normalizeDecision(value: string) {
  if (value === "approve") {
    return MediaModerationStatus.APPROVED;
  }
  if (value === "reject") {
    return MediaModerationStatus.REJECTED;
  }
  throw new Error("Choose approve or reject.");
}

function validateModerationNote(note: string | null) {
  if (note && note.length > 500) {
    throw new Error("Moderation notes must be 500 characters or fewer.");
  }
}

function revalidateMediaPaths(userId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/media");
  revalidatePath("/admin/users");
  revalidatePath("/admin/single-of-the-week");
  revalidatePath("/home");
  revalidatePath("/me");
  revalidatePath("/single-of-the-week");
  if (userId) {
    revalidatePath(`/users/${userId}`);
  }
}

function getReturnFilters(formData: FormData) {
  return {
    currentType: textValue(formData, "currentType") || "all",
    currentStatus: textValue(formData, "currentStatus") || "pending",
    currentPriority: textValue(formData, "currentPriority") || "all",
    currentStale: textValue(formData, "currentStale") || "all",
    returnTo: textValue(formData, "returnTo"),
  };
}

export async function reviewProfileImageAssetAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const assetId = textValue(formData, "assetId");
  const decision = normalizeDecision(textValue(formData, "decision"));
  const moderationNote = textValue(formData, "moderationNote") || null;
  const { currentType, currentStatus, currentPriority, currentStale, returnTo } = getReturnFilters(formData);

  validateModerationNote(moderationNote);

  const asset = await prisma.userProfileImageAsset.findUnique({
    where: { id: assetId },
    select: { id: true, userId: true, moderationStatus: true, hiddenByModeration: true },
  });

  if (!asset || !needsMediaModerationReview(asset)) {
    throw new Error("This profile image is no longer pending review.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userProfileImageAsset.update({
      where: { id: asset.id },
      data: {
        moderationStatus: decision,
        moderationNote,
        reviewedAt: new Date(),
        hiddenByModeration: false,
        hiddenAt: null,
        hiddenReason: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: decision === MediaModerationStatus.APPROVED ? "admin.media.profile_image.approved" : "admin.media.profile_image.rejected",
        targetType: "UserProfileImageAsset",
        targetId: asset.id,
        metadataJson: {
          subjectUserId: asset.userId,
          nextStatus: decision,
          moderationNote,
          wasHiddenByModeration: asset.hiddenByModeration,
        },
      },
    });
  });

  revalidateMediaPaths(asset.userId);
  redirectBack(currentType, currentStatus, currentPriority, currentStale, returnTo);
}

export async function reviewSingleOfWeekPhotoAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const photoId = textValue(formData, "photoId");
  const decision = normalizeDecision(textValue(formData, "decision"));
  const moderationNote = textValue(formData, "moderationNote") || null;
  const { currentType, currentStatus, currentPriority, currentStale, returnTo } = getReturnFilters(formData);

  validateModerationNote(moderationNote);

  const photo = await prisma.singleOfWeekApplicationPhoto.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      moderationStatus: true,
      hiddenByModeration: true,
      application: {
        select: {
          id: true,
          applicantUserId: true,
        },
      },
    },
  });

  if (!photo || !needsMediaModerationReview(photo)) {
    throw new Error("This Single of the Week photo is no longer pending review.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.singleOfWeekApplicationPhoto.update({
      where: { id: photo.id },
      data: {
        moderationStatus: decision,
        moderationNote,
        reviewedAt: new Date(),
        hiddenByModeration: false,
        hiddenAt: null,
        hiddenReason: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: decision === MediaModerationStatus.APPROVED ? "admin.media.single_of_week_photo.approved" : "admin.media.single_of_week_photo.rejected",
        targetType: "SingleOfWeekApplicationPhoto",
        targetId: photo.id,
        metadataJson: {
          applicationId: photo.application.id,
          subjectUserId: photo.application.applicantUserId,
          nextStatus: decision,
          moderationNote,
          wasHiddenByModeration: photo.hiddenByModeration,
        },
      },
    });
  });

  revalidateMediaPaths(photo.application.applicantUserId);
  redirectBack(currentType, currentStatus, currentPriority, currentStale, returnTo);
}

export async function bulkReviewMediaAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const decision = normalizeDecision(textValue(formData, "decision"));
  const moderationNote = textValue(formData, "moderationNote") || null;
  const selectedItems = formData
    .getAll("selectedItems")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const { currentType, currentStatus, currentPriority, currentStale, returnTo } = getReturnFilters(formData);

  validateModerationNote(moderationNote);

  const profileIds = selectedItems.filter((value) => value.startsWith("profile:")).map((value) => value.slice(8));
  const photoIds = selectedItems.filter((value) => value.startsWith("single-of-week:")).map((value) => value.slice(15));

  if (profileIds.length === 0 && photoIds.length === 0) {
    redirectBack(currentType, currentStatus, currentPriority, currentStale, returnTo);
  }

  const revalidatedUserIds = new Set<string>();
  const reviewedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const [profileAssets, photos] = await Promise.all([
      profileIds.length > 0
        ? tx.userProfileImageAsset.findMany({
            where: { id: { in: profileIds } },
            select: { id: true, userId: true, moderationStatus: true, hiddenByModeration: true },
          })
        : Promise.resolve([]),
      photoIds.length > 0
        ? tx.singleOfWeekApplicationPhoto.findMany({
            where: { id: { in: photoIds } },
            select: {
              id: true,
              moderationStatus: true,
              hiddenByModeration: true,
              application: { select: { applicantUserId: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const reviewableProfileIds = profileAssets.filter((asset) => needsMediaModerationReview(asset)).map((asset) => asset.id);
    const reviewablePhotoIds = photos.filter((photo) => needsMediaModerationReview(photo)).map((photo) => photo.id);

    if (reviewableProfileIds.length > 0) {
      await tx.userProfileImageAsset.updateMany({
        where: { id: { in: reviewableProfileIds } },
        data: {
          moderationStatus: decision,
          ...(moderationNote ? { moderationNote } : {}),
          reviewedAt,
          hiddenByModeration: false,
          hiddenAt: null,
          hiddenReason: null,
        },
      });
      profileAssets.forEach((asset) => {
        if (reviewableProfileIds.includes(asset.id)) {
          revalidatedUserIds.add(asset.userId);
        }
      });
    }

    if (reviewablePhotoIds.length > 0) {
      await tx.singleOfWeekApplicationPhoto.updateMany({
        where: { id: { in: reviewablePhotoIds } },
        data: {
          moderationStatus: decision,
          ...(moderationNote ? { moderationNote } : {}),
          reviewedAt,
          hiddenByModeration: false,
          hiddenAt: null,
          hiddenReason: null,
        },
      });
      photos.forEach((photo) => {
        if (reviewablePhotoIds.includes(photo.id)) {
          revalidatedUserIds.add(photo.application.applicantUserId);
        }
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: decision === MediaModerationStatus.APPROVED ? "admin.media.bulk.approved" : "admin.media.bulk.rejected",
        targetType: "MediaModerationBulk",
        metadataJson: {
          profileIds: reviewableProfileIds,
          singleOfWeekPhotoIds: reviewablePhotoIds,
          moderationNote,
          nextStatus: decision,
        },
      },
    });
  });

  revalidatedUserIds.forEach((userId) => revalidateMediaPaths(userId));
  revalidateMediaPaths();
  redirectBack(currentType, currentStatus, currentPriority, currentStale, returnTo);
}


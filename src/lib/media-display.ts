import { MediaModerationStatus, MediaStorageProvider } from "@prisma/client";
import { isMediaPubliclyVisible } from "@/lib/media-moderation";

export function resolveProfileImageUrl(input: {
  approvedProfileImageAsset?: { id: string; storageProvider: MediaStorageProvider; hiddenByModeration?: boolean | null } | null;
  legacyImage?: string | null;
}) {
  if (input.approvedProfileImageAsset && !input.approvedProfileImageAsset.hiddenByModeration) {
    return `/api/media/profile-image/${input.approvedProfileImageAsset.id}`;
  }
  return input.legacyImage ?? null;
}

export function resolveSingleOfWeekPhotoUrl(photo: {
  id: string;
  storageKey: string;
  storageProvider: MediaStorageProvider;
  moderationStatus: MediaModerationStatus;
  hiddenByModeration?: boolean | null;
}) {
  if (!isMediaPubliclyVisible(photo)) {
    return null;
  }
  if (photo.storageProvider === MediaStorageProvider.R2) {
    return `/api/media/single-of-week-photo/${photo.id}`;
  }
  return photo.storageKey;
}

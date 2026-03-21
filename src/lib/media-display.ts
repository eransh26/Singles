import { MediaModerationStatus, MediaStorageProvider } from "@prisma/client";

export function resolveProfileImageUrl(input: {
  approvedProfileImageAsset?: { id: string; storageProvider: MediaStorageProvider } | null;
  legacyImage?: string | null;
}) {
  if (input.approvedProfileImageAsset?.storageProvider === MediaStorageProvider.R2) {
    return `/api/media/profile-image/${input.approvedProfileImageAsset.id}`;
  }
  return input.legacyImage ?? null;
}

export function resolveSingleOfWeekPhotoUrl(photo: {
  id: string;
  storageKey: string;
  storageProvider: MediaStorageProvider;
  moderationStatus: MediaModerationStatus;
}) {
  if (photo.moderationStatus !== MediaModerationStatus.APPROVED) {
    return null;
  }
  if (photo.storageProvider === MediaStorageProvider.R2) {
    return `/api/media/single-of-week-photo/${photo.id}`;
  }
  return photo.storageKey;
}

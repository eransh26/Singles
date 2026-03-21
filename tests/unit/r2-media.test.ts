import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MediaModerationStatus, MediaStorageProvider } from "@prisma/client";
import { resolveProfileImageUrl, resolveSingleOfWeekPhotoUrl } from "../../src/lib/media-display";
import { R2_MEDIA_MAX_BYTES, processProfileImage, readAndValidateSourceImage, uploadProfileImageToR2 } from "../../src/lib/r2-media";

async function createPngBuffer() {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 120, g: 80, b: 160 },
    },
  })
    .png()
    .toBuffer();
}

test("rejects unsupported image types", async () => {
  const file = new File([Buffer.from("<svg></svg>")], "bad.svg", { type: "image/svg+xml" });
  await assert.rejects(() => readAndValidateSourceImage(file), /JPG, PNG, or WEBP/i);
});

test("rejects oversized uploads", async () => {
  const file = new File([Buffer.alloc(R2_MEDIA_MAX_BYTES + 1)], "too-big.png", { type: "image/png" });
  await assert.rejects(() => readAndValidateSourceImage(file), /5 MB or smaller/i);
});

test("accepts and processes a valid profile image into a square webp", async () => {
  const png = await createPngBuffer();
  const file = new File([png], "profile.png", { type: "image/png" });

  const validated = await readAndValidateSourceImage(file);
  assert.equal(validated.detectedMimeType, "image/png");

  const processed = await processProfileImage(file);
  const metadata = await sharp(processed.buffer).metadata();
  assert.equal(processed.contentType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
});

test("uploads processed profile images to an R2 object key and returns metadata only", async () => {
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";

  const png = await createPngBuffer();
  const file = new File([png], "profile.png", { type: "image/png" });
  let captured: { Bucket?: string; Key?: string; ContentType?: string; Body?: unknown } | null = null;

  const uploaded = await uploadProfileImageToR2("user-123", file, {
    async send(command) {
      captured = (command as { input?: { Bucket?: string; Key?: string; ContentType?: string; Body?: unknown } }).input ?? null;
      return {};
    },
  });

  assert.ok(captured);
  assert.equal(captured?.Bucket, "test-bucket");
  assert.match(captured?.Key ?? "", /^profiles\/user-123\//);
  assert.equal(captured?.ContentType, "image/webp");
  assert.equal(uploaded.storageProvider, MediaStorageProvider.R2);
  assert.equal(uploaded.moderationStatus, MediaModerationStatus.PENDING_REVIEW);
  assert.equal(uploaded.mimeType, "image/webp");
  assert.ok(!uploaded.objectKey.startsWith("data:"));
});

test("pending media is gated from display helpers", () => {
  assert.equal(resolveProfileImageUrl({ approvedProfileImageAsset: null, legacyImage: "/avatars/avatar-neutral-1.svg" }), "/avatars/avatar-neutral-1.svg");
  assert.equal(resolveProfileImageUrl({ approvedProfileImageAsset: { id: "asset-1", storageProvider: MediaStorageProvider.R2 }, legacyImage: "/avatars/avatar-neutral-1.svg" }), "/api/media/profile-image/asset-1");
  assert.equal(resolveSingleOfWeekPhotoUrl({ id: "photo-1", storageKey: "single-of-week/u/a/file.webp", storageProvider: MediaStorageProvider.R2, moderationStatus: MediaModerationStatus.PENDING_REVIEW }), null);
  assert.equal(resolveSingleOfWeekPhotoUrl({ id: "photo-2", storageKey: "single-of-week/u/a/file.webp", storageProvider: MediaStorageProvider.R2, moderationStatus: MediaModerationStatus.APPROVED }), "/api/media/single-of-week-photo/photo-2");
});

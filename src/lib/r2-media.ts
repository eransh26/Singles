
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MediaModerationStatus, MediaStorageProvider } from "@prisma/client";
import sharp from "sharp";

const FIVE_MB = 5 * 1024 * 1024;
const ALLOWED_FORMATS = new Map([
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export const R2_MEDIA_MAX_BYTES = FIVE_MB;
export const R2_MEDIA_ALLOWED_MIME_TYPES = new Set(ALLOWED_FORMATS.values());

export type StoredMediaUpload = {
  objectKey: string;
  storageProvider: MediaStorageProvider;
  mimeType: "image/webp";
  moderationStatus: MediaModerationStatus;
  uploadedAt: Date;
};

type R2LikeClient = {
  send(command: PutObjectCommand | GetObjectCommand): Promise<unknown>;
};

let cachedClient: S3Client | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the R2 media pipeline.`);
  }
  return value;
}

export function getR2MediaConfig() {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = requiredEnv("R2_BUCKET_NAME");

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export function getR2Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getR2MediaConfig();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

export async function readAndValidateSourceImage(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("Image upload could not be processed.");
  }
  if (buffer.byteLength > R2_MEDIA_MAX_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    throw new Error("Images must be JPG, PNG, or WEBP.");
  }
  const format = metadata.format?.toLowerCase() ?? "";
  const detectedMimeType = ALLOWED_FORMATS.get(format);
  if (!detectedMimeType) {
    throw new Error("Images must be JPG, PNG, or WEBP.");
  }

  return { buffer, detectedMimeType };
}

export async function processProfileImage(file: File) {
  const { buffer } = await readAndValidateSourceImage(file);
  const processedBuffer = await sharp(buffer)
    .resize(512, 512, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();

  return {
    buffer: processedBuffer,
    contentType: "image/webp" as const,
  };
}

export async function processSingleOfWeekImage(file: File) {
  const { buffer } = await readAndValidateSourceImage(file);
  const processedBuffer = await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();

  return {
    buffer: processedBuffer,
    contentType: "image/webp" as const,
  };
}

export function buildProfileImageObjectKey(userId: string, timestamp = Date.now()) {
  return `profiles/${userId}/${timestamp}-${randomUUID().slice(0, 8)}.webp`;
}

export function buildSingleOfWeekPhotoObjectKey(userId: string, applicationId: string, timestamp = Date.now()) {
  return `single-of-week/${userId}/${applicationId}/${timestamp}-${randomUUID().slice(0, 8)}.webp`;
}

export async function uploadBufferToR2(objectKey: string, buffer: Buffer, contentType: string, client: R2LikeClient = getR2Client()) {
  const { bucketName } = getR2MediaConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=3600",
    }),
  );
}

export async function uploadProfileImageToR2(userId: string, file: File, client?: R2LikeClient): Promise<StoredMediaUpload> {
  const processed = await processProfileImage(file);
  const objectKey = buildProfileImageObjectKey(userId);
  await uploadBufferToR2(objectKey, processed.buffer, processed.contentType, client);
  return {
    objectKey,
    storageProvider: MediaStorageProvider.R2,
    mimeType: processed.contentType,
    moderationStatus: MediaModerationStatus.PENDING_REVIEW,
    uploadedAt: new Date(),
  };
}

export async function uploadSingleOfWeekImageToR2(userId: string, applicationId: string, file: File, client?: R2LikeClient): Promise<StoredMediaUpload> {
  const processed = await processSingleOfWeekImage(file);
  const objectKey = buildSingleOfWeekPhotoObjectKey(userId, applicationId);
  await uploadBufferToR2(objectKey, processed.buffer, processed.contentType, client);
  return {
    objectKey,
    storageProvider: MediaStorageProvider.R2,
    mimeType: processed.contentType,
    moderationStatus: MediaModerationStatus.PENDING_REVIEW,
    uploadedAt: new Date(),
  };
}

export async function getR2ObjectStream(objectKey: string, client: R2LikeClient = getR2Client()) {
  const { bucketName } = getR2MediaConfig();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  ) as { Body?: { transformToWebStream?: () => ReadableStream; transformToByteArray?: () => Promise<Uint8Array> }; ContentType?: string | undefined };

  if (!response.Body) {
    throw new Error("Media not found.");
  }

  if (typeof response.Body.transformToWebStream === "function") {
    return {
      body: response.Body.transformToWebStream(),
      contentType: response.ContentType ?? "image/webp",
    };
  }

  const bytes = typeof response.Body.transformToByteArray === "function"
    ? await response.Body.transformToByteArray()
    : new Uint8Array();
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    contentType: response.ContentType ?? "image/webp",
  };
}





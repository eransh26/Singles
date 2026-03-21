import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { MediaStorageProvider, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { isMediaPubliclyVisible } from "@/lib/media-moderation";
import { getR2ObjectStream } from "@/lib/r2-media";

function decodeInlineImageDataUrl(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Media not found.");
  }

  return {
    contentType: match[1],
    body: Buffer.from(match[2], "base64"),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.r2MediaPipeline, user))) {
    return NextResponse.json({ error: "Feature unavailable" }, { status: 404 });
  }

  const { assetId } = await params;
  const asset = await prisma.userProfileImageAsset.findUnique({
    where: { id: assetId },
    select: { objectKey: true, moderationStatus: true, hiddenByModeration: true, storageProvider: true },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin && !isMediaPubliclyVisible(asset)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (asset.storageProvider === MediaStorageProvider.LEGACY_INLINE) {
    try {
      const inlineImage = decodeInlineImageDataUrl(asset.objectKey);
      return new NextResponse(inlineImage.body, {
        headers: {
          "Content-Type": inlineImage.contentType,
          "Cache-Control": isAdmin ? "private, no-store" : "private, max-age=3600",
        },
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const object = await getR2ObjectStream(asset.objectKey);
  return new NextResponse(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": isAdmin ? "private, no-store" : "private, max-age=3600",
    },
  });
}

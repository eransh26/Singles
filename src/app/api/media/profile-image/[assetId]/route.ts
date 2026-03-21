import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getR2ObjectStream } from "@/lib/r2-media";

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
    select: { objectKey: true, moderationStatus: true },
  });

  if (!asset || asset.moderationStatus !== "APPROVED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await getR2ObjectStream(asset.objectKey);
  return new NextResponse(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

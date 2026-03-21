import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { recordSingleOfWeekView } from "@/lib/single-of-the-week";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.singleOfWeek, user))) {
    return NextResponse.json({ error: "Feature unavailable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as { featureId?: string } | null;
  if (!body?.featureId) {
    return NextResponse.json({ error: "featureId is required" }, { status: 400 });
  }

  await recordSingleOfWeekView(body.featureId, user.id);
  return NextResponse.json({ ok: true });
}

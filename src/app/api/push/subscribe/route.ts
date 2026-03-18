import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const user = await requireUser();
  const payload = await request.json().catch(() => null);

  const endpoint = typeof payload?.endpoint === "string" ? payload.endpoint : "";
  const p256dh = typeof payload?.keys?.p256dh === "string" ? payload.keys.p256dh : "";
  const auth = typeof payload?.keys?.auth === "string" ? payload.keys.auth : "";
  const deviceLabel = typeof payload?.deviceLabel === "string" ? payload.deviceLabel.slice(0, 120) : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "A valid push subscription is required." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.webPushSubscription.upsert({
      where: { endpoint },
      update: { userId: user.id, p256dh, auth, deviceLabel },
      create: { userId: user.id, endpoint, p256dh, auth, deviceLabel },
    });

    await tx.userSettings.upsert({
      where: { userId: user.id },
      update: { webPushEnabled: true, pushPromptDismissedAt: null },
      create: { userId: user.id, webPushEnabled: true, pushPromptDismissedAt: null },
    });
  });

  const deviceCount = await prisma.webPushSubscription.count({ where: { userId: user.id } });
  return NextResponse.json({ ok: true, deviceCount });
}

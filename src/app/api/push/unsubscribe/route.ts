import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const user = await requireUser();
  const payload = await request.json().catch(() => null);
  const endpoint = typeof payload?.endpoint === "string" ? payload.endpoint : null;

  if (endpoint) {
    await prisma.webPushSubscription.deleteMany({
      where: { userId: user.id, endpoint },
    });
  }

  const deviceCount = await prisma.webPushSubscription.count({ where: { userId: user.id } });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { webPushEnabled: deviceCount > 0 },
    create: { userId: user.id, webPushEnabled: false },
  });

  return NextResponse.json({ ok: true, deviceCount });
}

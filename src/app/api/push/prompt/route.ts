import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const user = await requireUser();
  const payload = await request.json().catch(() => null);

  if (payload?.action !== "dismiss") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { pushPromptDismissedAt: new Date() },
    create: { userId: user.id, pushPromptDismissedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

import { ActivityContextType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  const payload = await request.json().catch(() => null);

  const contextType = typeof payload?.contextType === "string" && Object.values(ActivityContextType).includes(payload.contextType as ActivityContextType)
    ? (payload.contextType as ActivityContextType)
    : ActivityContextType.APP;
  const contextId = typeof payload?.contextId === "string" && payload.contextId ? payload.contextId.slice(0, 120) : null;
  const isVisible = payload?.isVisible !== false;

  await prisma.userActivityState.upsert({
    where: { userId: user.id },
    update: {
      lastActiveAt: new Date(),
      contextType,
      contextId,
      isVisible,
    },
    create: {
      userId: user.id,
      lastActiveAt: new Date(),
      contextType,
      contextId,
      isVisible,
    },
  });

  return NextResponse.json({ ok: true });
}

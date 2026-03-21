import { BuddyRequestStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { createBuddyRequestAction } from "../actions";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getBuddyDomainOptions, getBuddyRequestCooldownDeadline } from "@/lib/buddy";
import { BuddyRequestForm } from "@/components/buddy-request-form";
import { FeatureUnavailableCard } from "@/components/feature-unavailable-card";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";

export default async function NewBuddyRequestPage() {
  const viewer = await requireActiveUser();
  const featureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.buddy, viewer);

  if (!featureEnabled) {
    return (
      <FeatureUnavailableCard
        eyebrow="Buddy"
        title="Buddy is currently unavailable"
        description="Buddy support is turned off right now. Your regular chats and settings are still available."
        href="/home"
      />
    );
  }

  const [existingOpenRequest, recentCancelledRequest, domainOptions] = await Promise.all([
    prisma.buddyRequest.findFirst({
      where: {
        seekerId: viewer.id,
        status: { in: [BuddyRequestStatus.PENDING, BuddyRequestStatus.AWAITING_SEEKER_DECISION, BuddyRequestStatus.ASSIGNED] },
      },
      select: { id: true },
    }),
    prisma.buddyRequest.findFirst({
      where: {
        seekerId: viewer.id,
        status: BuddyRequestStatus.CANCELLED,
        closedAt: { not: null },
      },
      orderBy: { closedAt: "desc" },
      select: { closedAt: true },
    }),
    getBuddyDomainOptions(),
  ]);

  if (existingOpenRequest) {
    redirect("/buddy?saved=request-already-open");
  }

  if (recentCancelledRequest?.closedAt) {
    const cooldownUntil = getBuddyRequestCooldownDeadline(recentCancelledRequest.closedAt);
    if (cooldownUntil > new Date()) {
      redirect(`/buddy?saved=request-cooldown&cooldownUntil=${encodeURIComponent(cooldownUntil.toISOString())}`);
    }
  }

  return (
    <main className="lux-shell max-w-4xl">
      <section className="lux-hero">
        <div className="max-w-3xl">
          <p className="lux-overline">Need help? Get a Buddy</p>
          <h1 className="lux-title mt-3">Ask for support without having to browse for the right person.</h1>
          <p className="lux-body mt-4">
            Choose the support area that fits best. Your request will be routed privately to available Buddies in that domain.
          </p>
        </div>
      </section>

      <section className="lux-card">
        <div className="border-b lux-divider pb-5">
          <p className="lux-overline">Buddy request</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Peer support, not therapy or legal advice</h2>
        </div>
        <BuddyRequestForm action={createBuddyRequestAction} domainOptions={domainOptions} />
      </section>
    </main>
  );
}

import Link from "next/link";
import { SingleOfWeekApplicationStatus, SingleOfWeekFeatureStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { canApplyForSingleOfWeek, getEditWindowDeadline, syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { RelativeTime } from "@/components/relative-time";
import { FeatureUnavailableCard } from "@/components/feature-unavailable-card";
import { SingleOfWeekApplicationForm } from "@/components/single-of-week-application-form";
import {
  respondToSingleOfWeekSelectionAction,
  submitSingleOfWeekApplicationAction,
  withdrawSingleOfWeekApplicationAction,
} from "./actions";

const saveMessages: Record<string, string> = {
  application: "Single of the Week application saved.",
  response: "Your featured response was saved.",
  withdrawn: "Single of the Week application withdrawn.",
  "featured-chat-request": "Featured request sent.",
};

export default async function SingleOfWeekPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const featureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.singleOfWeek, user);

  if (!featureEnabled) {
    return (
      <FeatureUnavailableCard
        eyebrow="Single of the Week"
        title="Single of the Week is currently unavailable"
        description="This weekly feature is turned off right now. The rest of your profile and chat settings are still available."
        href="/settings"
        actionLabel="Open settings"
      />
    );
  }

  await syncSingleOfWeekState();

  const [eligibility, application, activeFeature] = await Promise.all([
    canApplyForSingleOfWeek(prisma, user.id),
    prisma.singleOfWeekApplication.findFirst({
      where: {
        applicantUserId: user.id,
        status: { in: [SingleOfWeekApplicationStatus.SUBMITTED, SingleOfWeekApplicationStatus.SHORTLISTED, SingleOfWeekApplicationStatus.SELECTED] },
      },
      orderBy: { submittedAt: "desc" },
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        features: {
          where: { status: { in: [SingleOfWeekFeatureStatus.UPCOMING, SingleOfWeekFeatureStatus.AWAITING_RESPONSE, SingleOfWeekFeatureStatus.ACTIVE] } },
          orderBy: { publishAt: "asc" },
          take: 1,
        },
      },
    }),
    prisma.singleOfWeekFeature.findFirst({
      where: { featuredUserId: user.id, status: { in: [SingleOfWeekFeatureStatus.UPCOMING, SingleOfWeekFeatureStatus.AWAITING_RESPONSE, SingleOfWeekFeatureStatus.ACTIVE] } },
      orderBy: { publishAt: "asc" },
      select: { id: true, status: true, publishAt: true, notifyAt: true },
    }),
  ]);

  const feature = application?.features[0] ?? activeFeature ?? null;
  const deadline = feature ? getEditWindowDeadline(feature.publishAt) : null;
  const editingLocked = Boolean(deadline && new Date() >= deadline);
  const savedMessage = resolvedSearchParams?.saved ? saveMessages[resolvedSearchParams.saved] : null;

  return (
    <main className="lux-shell space-y-6">
      {savedMessage ? <div className="rounded-[1.25rem] border border-[color:rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] px-4 py-3 text-sm text-[color:var(--lux-success)]">{savedMessage}</div> : null}

      <section className="lux-hero">
        <p className="lux-overline">Single of the Week</p>
        <h1 className="lux-title mt-3">A dedicated weekly feature for one verified member.</h1>
        <p className="lux-body mt-4">This snapshot is separate from your main profile and is reviewed manually before it ever appears on the home screen.</p>
      </section>

      {!eligibility.allowed ? (
        <section className="lux-card space-y-3">
          <p className="text-lg font-semibold tracking-tight text-[color:var(--lux-text)]">You cannot apply right now</p>
          <p className="text-sm leading-6 text-[color:var(--lux-text-secondary)]">{eligibility.reason}</p>
          <div className="flex gap-3">
            <Link className="lux-button-secondary" href="/settings">Open settings</Link>
          </div>
        </section>
      ) : null}

      {feature && (feature.status === SingleOfWeekFeatureStatus.AWAITING_RESPONSE || feature.status === SingleOfWeekFeatureStatus.UPCOMING) ? (
        <section className="lux-card space-y-4">
          <div>
            <p className="lux-overline">Selection status</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">You were selected for an upcoming feature week</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Publish date <RelativeTime value={feature.publishAt.toISOString()} />. You can accept or decline this invitation before the feature goes live.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={respondToSingleOfWeekSelectionAction}>
              <input name="featureId" type="hidden" value={feature.id} />
              <input name="decision" type="hidden" value="accept" />
              <button className="lux-button-primary" type="submit">Accept feature</button>
            </form>
            <form action={respondToSingleOfWeekSelectionAction}>
              <input name="featureId" type="hidden" value={feature.id} />
              <input name="decision" type="hidden" value="decline" />
              <button className="lux-button-secondary" type="submit">Decline</button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="lux-card space-y-5" id="single-of-week">
        <div className="border-b lux-divider pb-5">
          <p className="lux-overline">Application</p>
          <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Featured profile snapshot</h2>
          {application ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Submitted <RelativeTime value={application.submittedAt.toISOString()} />. Current state: {application.status}.</p>
          ) : null}
        </div>

        {application && application.status !== SingleOfWeekApplicationStatus.SELECTED ? (
          <form action={withdrawSingleOfWeekApplicationAction} className="flex justify-end">
            <input name="applicationId" type="hidden" value={application.id} />
            <button className="lux-button-secondary" type="submit">Withdraw application</button>
          </form>
        ) : null}

        <SingleOfWeekApplicationForm
          action={submitSingleOfWeekApplicationAction}
          disabled={!eligibility.allowed || editingLocked}
          disabledMessage={editingLocked ? "Editing is locked because this feature week is less than one day away." : null}
          initialValues={{
            bio: application?.bio,
            interests: application?.interests,
            hobbies: application?.hobbies,
            relationshipIntent: application?.relationshipIntent,
            preferredLocation: application?.preferredLocation,
            consented: Boolean(application?.consentedAt),
          }}
        />
      </section>
    </main>
  );
}

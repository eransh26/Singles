import { SingleOfWeekApplicationStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { buildSingleOfWeekShortlist, ensureSingleOfWeekConfig, getSingleOfWeekEffectiveTargetCaps, getSingleOfWeekFeatureMetrics, getSingleOfWeekTargetUsage, syncSingleOfWeekState } from "@/lib/single-of-the-week";
import { AdminPageIntro, SavedMessageBanner } from "../lib";
import {
  hideSingleOfWeekFeatureAdminAction,
  reviewSingleOfWeekApplicationAdminAction,
  saveSingleOfWeekConfigAdminAction,
  saveSingleOfWeekFeatureCapsAdminAction,
  selectSingleOfWeekApplicationAdminAction,
  shortlistSingleOfWeekApplicationAdminAction,
} from "./actions";

export default async function AdminSingleOfWeekPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const resolvedSearchParams = await searchParams;
  await ensureSingleOfWeekConfig();
  await syncSingleOfWeekState();

  const [config, applications, shortlist, features] = await Promise.all([
    prisma.singleOfWeekConfig.findUnique({ where: { id: "default" } }),
    prisma.singleOfWeekApplication.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        applicant: { select: { id: true, displayName: true, email: true, region: true } },
        photos: { orderBy: { sortOrder: "asc" } },
        features: { orderBy: { publishAt: "desc" }, take: 1 },
      },
      take: 20,
    }),
    buildSingleOfWeekShortlist(6),
    prisma.singleOfWeekFeature.findMany({
      orderBy: { publishAt: "desc" },
      include: {
        featuredUser: { select: { displayName: true, email: true } },
        application: { select: { bio: true } },
        requestLimitOverride: true,
      },
      take: 10,
    }),
  ]);

  const featureMetrics = await Promise.all(features.map(async (feature) => {
    const [metrics, effectiveCaps, usage] = await Promise.all([
      getSingleOfWeekFeatureMetrics(feature.id),
      getSingleOfWeekEffectiveTargetCaps(feature.id),
      getSingleOfWeekTargetUsage(feature.id, feature.featuredUserId),
    ]);
    return { id: feature.id, ...metrics, effectiveCaps, usage };
  }));
  const metricsByFeatureId = new Map(featureMetrics.map((entry) => [entry.id, entry]));

  return (
    <main className="space-y-6">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Single of the Week"
        title="Featured member administration"
        description="Manage weekly featured applications, shortlist candidates, set request caps, and hide the feature immediately if moderation needs it."
      />

      <section className="admin-surface p-6">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Request caps</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Global featured request limits</h2>
        </div>
        <form action={saveSingleOfWeekConfigAdminAction} className="mt-5 space-y-6">
          <div>
            <p className="text-sm font-medium text-[#fff4ea]">Target-user caps</p>
            <p className="mt-1 text-xs text-[#bbaea1]">These caps limit how many inbound requests the currently featured member can receive across all chat entry points while featured.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm text-[#d7c8bb]"><span>Daily cap</span><input className="admin-input" defaultValue={config?.targetDailyCap ?? 10} name="targetDailyCap" type="number" min="0" /></label>
              <label className="grid gap-2 text-sm text-[#d7c8bb]"><span>Weekly cap</span><input className="admin-input" defaultValue={config?.targetWeeklyCap ?? 20} name="targetWeeklyCap" type="number" min="0" /></label>
              <label className="grid gap-2 text-sm text-[#d7c8bb]"><span>Monthly cap</span><input className="admin-input" defaultValue={config?.targetMonthlyCap ?? 50} name="targetMonthlyCap" type="number" min="0" /></label>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[#fff4ea]">Requester caps</p>
            <p className="mt-1 text-xs text-[#bbaea1]">These caps limit how many featured requests one sender can create through Single of the Week surfaces.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm text-[#d7c8bb]"><span>Daily cap</span><input className="admin-input" defaultValue={config?.requesterDailyCap ?? 3} name="requesterDailyCap" type="number" min="0" /></label>
              <label className="grid gap-2 text-sm text-[#d7c8bb]"><span>Weekly cap</span><input className="admin-input" defaultValue={config?.requesterWeeklyCap ?? 6} name="requesterWeeklyCap" type="number" min="0" /></label>
              <label className="grid gap-2 text-sm text-[#d7c8bb]"><span>Monthly cap</span><input className="admin-input" defaultValue={config?.requesterMonthlyCap ?? 12} name="requesterMonthlyCap" type="number" min="0" /></label>
            </div>
          </div>
          <div className="flex justify-end"><button className="admin-button-primary" type="submit">Save caps</button></div>
        </form>
      </section>

      <section className="admin-surface p-6">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Shortlist</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">System-generated shortlist</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shortlist.map(({ application, score }) => (
            <article className="admin-card" key={application.id}>
              <p className="text-lg font-semibold tracking-tight text-[#fff4ea]">{application.applicant.displayName}</p>
              <p className="mt-2 text-sm text-[#bbaea1]">{application.applicant.email}</p>
              <p className="mt-3 text-sm text-[#d7c8bb]">Score {score}</p>
              <form action={shortlistSingleOfWeekApplicationAdminAction} className="mt-4 flex items-center justify-between gap-3">
                <input name="applicationId" type="hidden" value={application.id} />
                <input name="score" type="hidden" value={score} />
                <button className="admin-button-secondary" type="submit">Add to shortlist</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-surface p-6" data-testid="admin-sotw-applications">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Applications</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Submitted, shortlisted, selected, and rejected profiles</h2>
        </div>
        <div className="mt-5 space-y-4">
          {applications.map((application) => (
            <article className="admin-card text-sm" key={application.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{application.applicant.displayName}</p>
                  <p className="text-[#bbaea1]">{application.applicant.email}</p>
                </div>
                <span className="admin-pill">{application.status}</span>
              </div>
              <p className="mt-3 leading-6 text-[#d7c8bb]">{application.bio}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#8f7f72]">Photos {application.photos.length}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {application.status !== SingleOfWeekApplicationStatus.REJECTED ? (
                  <>
                    <form action={reviewSingleOfWeekApplicationAdminAction}>
                      <input name="applicationId" type="hidden" value={application.id} />
                      <input name="decision" type="hidden" value="shortlist" />
                      <button className="admin-button-secondary" type="submit">Keep reviewable</button>
                    </form>
                    <form action={selectSingleOfWeekApplicationAdminAction}>
                      <input name="applicationId" type="hidden" value={application.id} />
                      <button className="admin-button-primary" type="submit">Select for next Sunday</button>
                    </form>
                  </>
                ) : null}
                <form action={reviewSingleOfWeekApplicationAdminAction} className="flex flex-wrap gap-2">
                  <input name="applicationId" type="hidden" value={application.id} />
                  <input name="decision" type="hidden" value="reject" />
                  <input className="admin-input" name="adminNotes" placeholder="Admin note" />
                  <button className="admin-button-secondary" type="submit">Reject</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-surface p-6" data-testid="admin-sotw-features">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Feature queue</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Upcoming, current, and past weekly features</h2>
        </div>
        <div className="mt-5 space-y-4">
          {features.map((feature) => {
            const metrics = metricsByFeatureId.get(feature.id);
            return (
              <article className="admin-card text-sm" key={feature.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{feature.featuredUser.displayName}</p>
                    <p className="text-[#bbaea1]">{feature.featuredUser.email}</p>
                  </div>
                  <span className="admin-pill">{feature.status}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div><p className="lux-overline text-[#8f7f72]">Views</p><p className="mt-2 text-[#fff4ea]">{metrics?.views ?? 0}</p></div>
                  <div><p className="lux-overline text-[#8f7f72]">Requests</p><p className="mt-2 text-[#fff4ea]">{metrics?.requests ?? 0}</p></div>
                  <div><p className="lux-overline text-[#8f7f72]">Approvals</p><p className="mt-2 text-[#fff4ea]">{metrics?.approvals ?? 0}</p></div>
                  <div><p className="lux-overline text-[#8f7f72]">Week</p><p className="mt-2 text-[#fff4ea]">{feature.weekOf.toISOString().slice(0, 10)}</p></div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div><p className="lux-overline text-[#8f7f72]">Effective daily</p><p className="mt-2 text-[#fff4ea]">{metrics?.effectiveCaps.dailyCap ?? 0} / {metrics?.usage.dailyCount ?? 0} used</p></div>
                  <div><p className="lux-overline text-[#8f7f72]">Effective weekly</p><p className="mt-2 text-[#fff4ea]">{metrics?.effectiveCaps.weeklyCap ?? 0} / {metrics?.usage.weeklyCount ?? 0} used</p></div>
                  <div><p className="lux-overline text-[#8f7f72]">Effective monthly</p><p className="mt-2 text-[#fff4ea]">{metrics?.effectiveCaps.monthlyCap ?? 0} / {metrics?.usage.monthlyCount ?? 0} used</p></div>
                </div>
                <form action={saveSingleOfWeekFeatureCapsAdminAction} className="mt-4 grid gap-3 md:grid-cols-4 md:items-end">
                  <input name="featureId" type="hidden" value={feature.id} />
                  <label className="grid gap-2 text-[#d7c8bb]"><span>Daily override</span><input className="admin-input" defaultValue={feature.requestLimitOverride?.dailyCap ?? ""} name="dailyCap" type="number" min="0" /></label>
                  <label className="grid gap-2 text-[#d7c8bb]"><span>Weekly override</span><input className="admin-input" defaultValue={feature.requestLimitOverride?.weeklyCap ?? ""} name="weeklyCap" type="number" min="0" /></label>
                  <label className="grid gap-2 text-[#d7c8bb]"><span>Monthly override</span><input className="admin-input" defaultValue={feature.requestLimitOverride?.monthlyCap ?? ""} name="monthlyCap" type="number" min="0" /></label>
                  <div className="md:col-span-4 flex flex-wrap justify-between gap-2 text-xs text-[#bbaea1]">
                    <span>Requester caps remain global: {config?.requesterDailyCap ?? 3} / {config?.requesterWeeklyCap ?? 6} / {config?.requesterMonthlyCap ?? 12}</span>
                    <button className="admin-button-secondary" type="submit">Save overrides</button>
                  </div>
                </form>
                <form action={hideSingleOfWeekFeatureAdminAction} className="mt-4 flex flex-wrap gap-2">
                  <input name="featureId" type="hidden" value={feature.id} />
                  <input className="admin-input" name="hiddenReason" placeholder="Reason for hiding" />
                  <button className="admin-button-secondary" type="submit">Hide immediately</button>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

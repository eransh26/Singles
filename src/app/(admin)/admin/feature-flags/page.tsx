import { FeatureFlagRolloutType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminPageIntro, SavedMessageBanner } from "../lib";
import { getFeatureFlags } from "@/lib/feature-flags";
import { updateFeatureFlagAdminAction } from "./actions";

export default async function AdminFeatureFlagsPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const resolvedSearchParams = await searchParams;
  const flags = await getFeatureFlags();

  return (
    <main className="space-y-6">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Feature flags"
        title="Feature rollout controls"
        description="Keep major product surfaces safely guarded by default and toggle them deliberately when they are ready for members."
      />

      <section className="admin-surface p-6" data-testid="admin-feature-flags">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Flags</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Buddy, Single of the Week, and future launches</h2>
        </div>
        <div className="mt-5 space-y-4">
          {flags.map((flag) => (
            <form action={updateFeatureFlagAdminAction} className="admin-card text-sm shadow-sm" key={flag.key}>
              <input name="key" type="hidden" value={flag.key} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{flag.key}</p>
                  <p className="mt-2 leading-6 text-[#bbaea1]">{flag.description ?? "No description yet."}</p>
                </div>
                <label className="flex items-center gap-3 rounded-[1.15rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.52)] px-4 py-3 text-sm text-[#d7c8bb]">
                  <input aria-label={`Enable ${flag.key}`} className="h-4 w-4 accent-[#c9a76e]" defaultChecked={flag.enabled} name="enabled" type="checkbox" />
                  Enabled
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,220px)_auto] md:items-end">
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">Rollout type</span>
                  <select className="admin-input" defaultValue={flag.rolloutType} name="rolloutType">
                    {Object.values(FeatureFlagRolloutType).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end">
                  <button className="admin-button-secondary" type="submit">Save flag</button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}

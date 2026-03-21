import Link from "next/link";
import {
  reviewBuddyApplicationDomainAdminAction,
} from "./buddy/actions";
import {
  reviewProfileImageAssetAdminAction,
  reviewSingleOfWeekPhotoAdminAction,
} from "./media/actions";
import { AdminPageIntro, SavedMessageBanner } from "./lib";
import { getAdminActionCenterData } from "./action-center-data";

function toneClasses(label: string) {
  if (label.includes("HIGH") || label.includes("Urgent") || label.includes("Auto-hidden")) {
    return "border-[rgba(210,161,152,0.3)] bg-[rgba(210,161,152,0.12)] text-[#f0ccc5]";
  }

  if (label.includes("LOW")) {
    return "border-[rgba(224,190,132,0.3)] bg-[rgba(224,190,132,0.12)] text-[#f2dfbc]";
  }

  return "border-[rgba(184,197,166,0.28)] bg-[rgba(184,197,166,0.12)] text-[#dfe8d5]";
}

function compactStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function inlineReviewHiddenFields() {
  return (
    <>
      <input name="returnTo" type="hidden" value="action-center" />
      <input name="currentType" type="hidden" value="all" />
      <input name="currentStatus" type="hidden" value="pending" />
      <input name="currentPriority" type="hidden" value="all" />
      <input name="currentStale" type="hidden" value="all" />
    </>
  );
}

export default async function AdminActionCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const actionCenter = await getAdminActionCenterData();

  return (
    <main className="space-y-6" data-testid="admin-action-center">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Action Center"
        title="Admin action center"
        description="Start with the work that needs attention now, then drop into deeper moderation, Buddy, featured, report, and verification tools when needed."
      />

      <section className="admin-surface p-6 md:p-7" data-testid="admin-action-needs-attention">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[rgba(90,76,66,0.36)] pb-5">
          <div>
            <p className="lux-overline text-[#a99687]">Needs attention</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[#fff4ea]">Urgent operational work</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c9bbae]">
              Highest-signal items across moderation, reports, Buddy, featured operations, and verification review.
            </p>
          </div>
          <Link className="admin-button-secondary" href="/admin/dashboard">
            Open dashboard
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {actionCenter.needsAttention.length === 0 ? (
            <article className="admin-card xl:col-span-2">
              <p className="text-sm text-[#d7c8bb]">No urgent admin items are waiting right now.</p>
            </article>
          ) : (
            actionCenter.needsAttention.map((item, index) => (
              <article
                key={item.id}
                className="admin-card flex flex-col gap-4"
                data-testid={`admin-action-needs-attention-item-${index}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${toneClasses(item.type)}`}>
                    {item.type}
                  </span>
                  <span className="text-xs text-[#aa9788]">{item.ageLabel}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#fff4ea]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#d7c8bb]">{item.summary}</p>
                  {item.context ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#aa9788]">{item.context}</p> : null}
                </div>
                <div className="mt-auto">
                  <Link className="admin-button-secondary inline-flex" href={item.href}>
                    {item.ctaLabel}
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="admin-surface p-6 md:p-7" data-testid="admin-action-moderation">
          <div className="flex items-end justify-between gap-3 border-b border-[rgba(90,76,66,0.36)] pb-5">
            <div>
              <p className="lux-overline text-[#a99687]">Moderation</p>
              <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Queue preview</h2>
            </div>
            <Link className="admin-button-secondary" href="/admin/media">
              Open full queue
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {actionCenter.moderationPreview.length === 0 ? (
              <article className="admin-card">
                <p className="text-sm text-[#d7c8bb]">No priority media items are waiting.</p>
              </article>
            ) : (
              actionCenter.moderationPreview.map((item, index) => (
                <article key={item.key} className="admin-card" data-testid={`admin-action-moderation-item-${index}`}>
                  <div className="flex gap-4">
                    <img
                      alt={`${item.displayName} preview`}
                      className="h-20 w-20 rounded-[1rem] border border-[rgba(90,76,66,0.32)] object-cover"
                      src={item.previewUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${toneClasses(item.priorityLabel)}`}>
                          {item.priorityLabel}
                        </span>
                        <span className="rounded-full border border-[rgba(184,197,166,0.28)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dfe8d5]">
                          Trust {item.trustLabel}
                        </span>
                        {item.staleLabel ? (
                          <span className="rounded-full border border-[rgba(224,190,132,0.28)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f2dfbc]">
                            {item.staleLabel}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-[#fff4ea]">
                        {item.displayName} · {item.itemType === "profile" ? "profile image" : "featured photo"}
                      </h3>
                      <p className="mt-1 text-sm text-[#c9bbae]">{item.email}</p>
                      <p className="mt-2 text-sm text-[#d7c8bb]">
                        {item.hiddenByModeration ? "Auto-hidden and awaiting review." : "Pending review."} {item.ageLabel}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.canInlineReview ? (
                          <>
                            <form action={item.itemType === "profile" ? reviewProfileImageAssetAdminAction : reviewSingleOfWeekPhotoAdminAction}>
                              {inlineReviewHiddenFields()}
                              {item.itemType === "profile" ? (
                                <input name="assetId" type="hidden" value={item.id} />
                              ) : (
                                <input name="photoId" type="hidden" value={item.id} />
                              )}
                              <input name="decision" type="hidden" value="approve" />
                              <button className="admin-button-primary" type="submit">
                                Approve
                              </button>
                            </form>
                            <form action={item.itemType === "profile" ? reviewProfileImageAssetAdminAction : reviewSingleOfWeekPhotoAdminAction}>
                              {inlineReviewHiddenFields()}
                              {item.itemType === "profile" ? (
                                <input name="assetId" type="hidden" value={item.id} />
                              ) : (
                                <input name="photoId" type="hidden" value={item.id} />
                              )}
                              <input name="decision" type="hidden" value="reject" />
                              <button className="admin-button-secondary" type="submit">
                                Reject
                              </button>
                            </form>
                          </>
                        ) : null}
                        <Link className="admin-button-secondary inline-flex" href={item.href}>
                          Open full moderation
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="admin-surface p-6 md:p-7" data-testid="admin-action-risk-signals">
          <div className="flex items-end justify-between gap-3 border-b border-[rgba(90,76,66,0.36)] pb-5">
            <div>
              <p className="lux-overline text-[#a99687]">Risk signals</p>
              <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">What changed recently</h2>
            </div>
            <Link className="text-sm text-[#d7c8bb] underline decoration-[rgba(215,200,187,0.45)] underline-offset-4" href="/admin/users">
              Open users
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {actionCenter.riskSignals.length === 0 ? (
              <article className="admin-card">
                <p className="text-sm text-[#d7c8bb]">No elevated risk signals were found.</p>
              </article>
            ) : (
              actionCenter.riskSignals.map((signal) => (
                <Link
                  key={signal.id}
                  className="admin-card block transition hover:border-[rgba(224,190,132,0.34)]"
                  href={signal.href}
                >
                  <h3 className="text-base font-semibold text-[#fff4ea]">{signal.title}</h3>
                  <p className="mt-2 text-sm text-[#d7c8bb]">{signal.summary}</p>
                  {signal.context ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#aa9788]">{signal.context}</p> : null}
                </Link>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="admin-surface p-6 md:p-7" data-testid="admin-action-buddy">
          <div className="flex items-end justify-between gap-3 border-b border-[rgba(90,76,66,0.36)] pb-5">
            <div>
              <p className="lux-overline text-[#a99687]">Buddy</p>
              <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Applications needing review</h2>
            </div>
            <Link className="admin-button-secondary" href="/admin/buddy">
              Open Buddy
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {actionCenter.buddyPreview.length === 0 ? (
              <article className="admin-card">
                <p className="text-sm text-[#d7c8bb]">No Buddy applications currently need attention.</p>
              </article>
            ) : (
              actionCenter.buddyPreview.map((item, index) => (
                <article key={item.id} className="admin-card" data-testid={`admin-action-buddy-item-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[rgba(184,197,166,0.28)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dfe8d5]">
                          Trust {item.trustLabel}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${toneClasses(item.status)}`}>
                          {compactStatusLabel(item.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-[#fff4ea]">{item.applicantName}</h3>
                      <p className="mt-1 text-sm text-[#c9bbae]">{item.domainName}</p>
                      <p className="mt-1 text-sm text-[#aa9788]">{item.applicantEmail}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.canInlineReview ? (
                          <>
                            <form action={reviewBuddyApplicationDomainAdminAction}>
                              <input name="applicationDomainId" type="hidden" value={item.applicationDomainId} />
                              <input name="decision" type="hidden" value="approve" />
                              <input name="returnTo" type="hidden" value="action-center" />
                              <button className="admin-button-primary" type="submit">
                                Approve
                              </button>
                            </form>
                            <form action={reviewBuddyApplicationDomainAdminAction}>
                              <input name="applicationDomainId" type="hidden" value={item.applicationDomainId} />
                              <input name="decision" type="hidden" value="reject" />
                              <input name="returnTo" type="hidden" value="action-center" />
                              <button className="admin-button-secondary" type="submit">
                                Reject
                              </button>
                            </form>
                          </>
                        ) : null}
                        <Link className="admin-button-secondary inline-flex" href="/admin/buddy">
                          Open Buddy
                        </Link>
                      </div>
                    </div>
                    <span className="text-xs text-[#aa9788]">{new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.round((Date.now() - item.createdAt.getTime()) / 86400000)), "day")}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="admin-surface p-6 md:p-7" data-testid="admin-action-featured">
          <div className="flex items-end justify-between gap-3 border-b border-[rgba(90,76,66,0.36)] pb-5">
            <div>
              <p className="lux-overline text-[#a99687]">Featured</p>
              <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Single of the Week</h2>
            </div>
            <Link className="admin-button-secondary" href="/admin/single-of-the-week">
              Open featured
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {actionCenter.featuredData.activeFeature ? (
              <article className="admin-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[rgba(184,197,166,0.28)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dfe8d5]">
                    Active feature
                  </span>
                  <span className="rounded-full border border-[rgba(184,197,166,0.28)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dfe8d5]">
                    Trust {actionCenter.featuredData.activeFeature.trustLabel}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-[#fff4ea]">{actionCenter.featuredData.activeFeature.displayName}</h3>
                <p className="mt-2 text-sm text-[#d7c8bb]">{actionCenter.featuredData.activeFeature.usageSummary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="admin-button-secondary inline-flex" href="/admin/single-of-the-week">
                    Open featured
                  </Link>
                  <Link className="admin-button-secondary inline-flex" href="/admin/media?type=single-of-week&status=pending">
                    Review featured media
                  </Link>
                </div>
              </article>
            ) : (
              <article className="admin-card">
                <p className="text-sm text-[#d7c8bb]">No active featured member is live right now.</p>
              </article>
            )}

            <div className="space-y-3">
              {actionCenter.featuredData.upcomingCandidates.length === 0 ? (
                <article className="admin-card">
                  <p className="text-sm text-[#d7c8bb]">No featured candidates are currently queued.</p>
                </article>
              ) : (
                actionCenter.featuredData.upcomingCandidates.map((candidate) => (
                  <article key={candidate.id} className="admin-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${toneClasses(candidate.trustLabel)}`}>
                        Trust {candidate.trustLabel}
                      </span>
                      <span className="rounded-full border border-[rgba(184,197,166,0.28)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dfe8d5]">
                        {compactStatusLabel(candidate.status)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-[#fff4ea]">{candidate.displayName}</h3>
                    <p className="mt-2 text-sm text-[#d7c8bb]">
                      {candidate.photoPendingCount > 0
                        ? `${candidate.photoPendingCount} featured photo item${candidate.photoPendingCount === 1 ? "" : "s"} still need review`
                        : "Featured media is clear for review."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link className="admin-button-secondary inline-flex" href="/admin/single-of-the-week">
                        Open candidate
                      </Link>
                      {candidate.photoPendingCount > 0 ? (
                        <Link className="admin-button-secondary inline-flex" href="/admin/media?type=single-of-week&status=pending">
                          Review media
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      <section className="admin-surface p-6 md:p-7" data-testid="admin-action-quick-actions">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Quick actions</p>
          <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Jump straight into deeper tools</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actionCenter.quickActions.map((action) => (
            <Link
              key={action.href}
              className="admin-card block transition hover:border-[rgba(184,197,166,0.34)]"
              href={action.href}
            >
              <h3 className="text-base font-semibold text-[#fff4ea]">{action.label}</h3>
              <p className="mt-2 text-sm leading-6 text-[#d7c8bb]">{action.hint}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

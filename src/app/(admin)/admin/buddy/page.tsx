import { BuddyApplicationDomainStatus } from "@prisma/client";
import { AdminPageIntro, SavedMessageBanner } from "../lib";
import {
  grantBuddyReapplicationOverrideAdminAction,
  reviewBuddyApplicationDomainAdminAction,
  saveBuddyDomainAdminAction,
} from "./actions";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export default async function AdminBuddyPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const resolvedSearchParams = await searchParams;

  const [applications, domains, domainStats, buddyReports] = await Promise.all([
    prisma.buddyApplication.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        applicant: { select: { id: true, displayName: true, email: true } },
        domains: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            domainId: true,
            domain: { select: { name: true } },
            recommendations: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                status: true,
                note: true,
                submittedAt: true,
                recommender: { select: { displayName: true, email: true } },
              },
            },
          },
        },
      },
      take: 20,
    }),
    prisma.buddyDomainRecord.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, description: true, isActive: true },
    }),
    prisma.buddyDomainRecord.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            buddyProfiles: true,
            buddyApplicationDomains: true,
          },
        },
      },
    }),
    prisma.report.findMany({
      where: { details: { contains: "Buddy", mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, reasonCode: true, details: true, createdAt: true, targetType: true },
    }),
  ]);

  return (
    <main className="space-y-6">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Buddy"
        title="Buddy administration"
        description="Review Buddy applications by domain, manage active support domains, and keep the Buddy pipeline operational without mixing it into general reports."
      />

      <section className="grid gap-4 md:grid-cols-3">
        {domainStats.map((domain) => (
          <article className="admin-card" key={domain.id}>
            <p className="lux-overline text-[#aa9788]">{domain.isActive ? "Active domain" : "Inactive domain"}</p>
            <p className="mt-3 text-xl font-semibold tracking-tight text-[#fff4ea]">{domain.name}</p>
            <p className="mt-3 text-sm leading-6 text-[#bbaea1]">Approved buddies: {domain._count.buddyProfiles}</p>
            <p className="text-sm leading-6 text-[#bbaea1]">Applications: {domain._count.buddyApplicationDomains}</p>
          </article>
        ))}
      </section>

      <section className="admin-surface p-6" data-testid="admin-buddy-domains">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Buddy domains</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Active and inactive support domains</h2>
        </div>
        <form action={saveBuddyDomainAdminAction} className="admin-card mt-5 grid gap-4 text-sm shadow-sm">
          <div>
            <p className="text-base font-semibold tracking-tight text-[#fff4ea]">Add Buddy domain</p>
            <p className="mt-2 text-sm leading-6 text-[#bbaea1]">Create a new support area or update an existing one below.</p>
          </div>
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Domain name</span>
            <input className="admin-input" name="name" required />
          </label>
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Description</span>
            <textarea className="admin-textarea min-h-20" name="description" />
          </label>
          <label className="flex items-center gap-3 rounded-[1.15rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.52)] px-4 py-3 text-sm text-[#d7c8bb]">
            <input aria-label="Active domain" className="h-4 w-4 accent-[#c9a76e]" defaultChecked name="isActive" type="checkbox" />
            Mark this domain as active
          </label>
          <div className="flex justify-end">
            <button className="admin-button-primary" type="submit">Save Buddy domain</button>
          </div>
        </form>

        <div className="mt-5 space-y-3">
          {domains.map((domain) => (
            <form action={saveBuddyDomainAdminAction} className="admin-card text-sm shadow-sm" key={domain.id}>
              <input name="buddyDomainId" type="hidden" value={domain.id} />
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">Domain name</span>
                  <input className="admin-input" defaultValue={domain.name} name="name" required />
                </label>
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">Description</span>
                  <input className="admin-input" defaultValue={domain.description ?? ""} name="description" />
                </label>
                <label className="flex items-center gap-3 rounded-[1.15rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.52)] px-4 py-3 text-sm text-[#d7c8bb]">
                  <input aria-label={`Active ${domain.name}`} className="h-4 w-4 accent-[#c9a76e]" defaultChecked={domain.isActive} name="isActive" type="checkbox" />
                  Active
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="admin-button-secondary" type="submit">Update domain</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="admin-surface p-6" data-testid="admin-buddy-applications">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Buddy applications</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Recommendation progress and domain-level review</h2>
        </div>
        <div className="mt-5 space-y-4">
          {applications.map((application) => (
            <article className="admin-card text-sm shadow-sm" key={application.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{application.applicant.displayName}</p>
                  <p className="text-[#bbaea1]">{application.applicant.email}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-[#8f7f72]">{application.createdAt.toISOString().slice(0, 10)}</span>
              </div>
              <div className="mt-4 space-y-4">
                {application.domains.map((domainEntry) => (
                  <div className="rounded-[1.2rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.6)] p-4" key={domainEntry.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold tracking-tight text-[#fff4ea]">{domainEntry.domain.name}</p>
                      <span className="admin-pill">{domainEntry.status}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {domainEntry.recommendations.map((recommendation) => (
                        <div className="rounded-[1rem] border border-[rgba(90,76,66,0.36)] px-3 py-3" key={recommendation.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[#fff4ea]">{recommendation.recommender.displayName}</span>
                            <span className="text-xs uppercase tracking-[0.14em] text-[#aa9788]">{recommendation.status}</span>
                          </div>
                          {recommendation.note ? <p className="mt-2 text-sm leading-6 text-[#bbaea1]">Admin note: {recommendation.note}</p> : <p className="mt-2 text-sm leading-6 text-[#8f7f72]">No admin-only note submitted.</p>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {domainEntry.status === BuddyApplicationDomainStatus.PENDING_ADMIN_REVIEW ? (
                        <>
                          <form action={reviewBuddyApplicationDomainAdminAction}>
                            <input name="applicationDomainId" type="hidden" value={domainEntry.id} />
                            <input name="decision" type="hidden" value="approve" />
                            <button className="admin-button-primary" type="submit">Approve domain</button>
                          </form>
                          <form action={reviewBuddyApplicationDomainAdminAction}>
                            <input name="applicationDomainId" type="hidden" value={domainEntry.id} />
                            <input name="decision" type="hidden" value="reject" />
                            <button className="admin-button-secondary" type="submit">Reject domain</button>
                          </form>
                        </>
                      ) : null}
                      {domainEntry.status === BuddyApplicationDomainStatus.REJECTED ? (
                        <form action={grantBuddyReapplicationOverrideAdminAction}>
                          <input name="userId" type="hidden" value={application.applicant.id} />
                          <input name="domainId" type="hidden" value={domainEntry.domainId} />
                          <button className="admin-button-secondary" type="submit">Allow another application</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-surface p-6" data-testid="admin-buddy-reports">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Buddy reports</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Operational visibility</h2>
        </div>
        <div className="mt-5 space-y-3">
          {buddyReports.length === 0 ? <p className="admin-empty">No Buddy-tagged reports yet.</p> : buddyReports.map((report) => (
            <div className="admin-card text-sm shadow-sm" key={report.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold tracking-tight text-[#fff4ea]">{report.targetType}</p>
                <span className="text-xs uppercase tracking-[0.14em] text-[#8f7f72]">{report.reasonCode}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#bbaea1]">{report.details ?? "No extra detail."}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

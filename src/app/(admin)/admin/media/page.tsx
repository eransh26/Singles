import Link from "next/link";
import { MediaModerationStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  formatPendingAge,
  formatWeightedSignalBreakdown,
  formatWeightedSignalSummary,
  getMediaQueuePriority,
  getMediaQueuePriorityLabel,
  getMediaQueuePriorityRank,
  getMediaReviewStartedAt,
  getMediaStaleLabel,
  getMediaStaleState,
  getWeightedUserReportSignalSummary,
  needsMediaModerationReview,
  type MediaQueuePriority,
  type MediaStaleState,
  type WeightedReportSignalSummary,
} from "@/lib/media-moderation";
import { formatTrustLabel, refreshUserTrustStates } from "@/lib/internal-trust";
import { AdminPageIntro, SavedMessageBanner, formatDateTime } from "../lib";
import {
  bulkReviewMediaAdminAction,
  reviewProfileImageAssetAdminAction,
  reviewSingleOfWeekPhotoAdminAction,
} from "./actions";

type MediaTypeFilter = "all" | "profile" | "single-of-week";
type MediaStatusFilter = "pending" | "approved" | "rejected" | "all";
type MediaPriorityFilter = "all" | MediaQueuePriority;
type MediaStaleFilter = "all" | "stale";

type MediaQueueItem = {
  key: string;
  id: string;
  type: "profile" | "single-of-week";
  ownerUserId: string;
  displayName: string;
  email: string;
  uploadedAt: Date;
  reviewStartedAt: Date;
  moderationStatus: MediaModerationStatus;
  moderationNote: string | null;
  hiddenByModeration: boolean;
  hiddenReason: string | null;
  priority: MediaQueuePriority;
  staleState: MediaStaleState;
  previewUrl: string;
  metaLabel: string;
  signalSummary: WeightedReportSignalSummary | null;
  ownerTrustLabel: string;
};

function normalizeType(value?: string): MediaTypeFilter {
  if (value === "profile" || value === "single-of-week" || value === "all") {
    return value;
  }
  return "all";
}

function normalizeStatus(value?: string): MediaStatusFilter {
  if (value === "approved" || value === "rejected" || value === "all" || value === "pending") {
    return value;
  }
  return "pending";
}

function normalizePriority(value?: string): MediaPriorityFilter {
  if (value === "urgent_featured" || value === "active_profile" || value === "profile" || value === "routine" || value === "all") {
    return value;
  }
  return "all";
}

function normalizeStale(value?: string): MediaStaleFilter {
  if (value === "stale" || value === "all") {
    return value;
  }
  return "all";
}

function buildFilterHref(filters: {
  type: MediaTypeFilter;
  status: MediaStatusFilter;
  priority: MediaPriorityFilter;
  stale: MediaStaleFilter;
}) {
  return `/admin/media?type=${filters.type}&status=${filters.status}&priority=${filters.priority}&stale=${filters.stale}`;
}

function filterLink(current: { type: MediaTypeFilter; status: MediaStatusFilter; priority: MediaPriorityFilter; stale: MediaStaleFilter }, next: Partial<{ type: MediaTypeFilter; status: MediaStatusFilter; priority: MediaPriorityFilter; stale: MediaStaleFilter }>, label: string) {
  const merged = {
    type: next.type ?? current.type,
    status: next.status ?? current.status,
    priority: next.priority ?? current.priority,
    stale: next.stale ?? current.stale,
  };
  const isActive = merged.type === current.type && merged.status === current.status && merged.priority === current.priority && merged.stale === current.stale;

  return (
    <Link
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${isActive ? "border-[#d2b385] bg-[rgba(210,179,133,0.16)] text-[#fff4ea]" : "border-[rgba(148,127,112,0.34)] text-[#cdbdae] hover:border-[rgba(210,179,133,0.32)]"}`}
      href={buildFilterHref(merged)}
      key={`${label}-${merged.type}-${merged.status}-${merged.priority}-${merged.stale}`}
    >
      {label}
    </Link>
  );
}

function matchesStatusFilter(item: MediaQueueItem, statusFilter: MediaStatusFilter) {
  if (statusFilter === "all") {
    return true;
  }
  if (statusFilter === "pending") {
    return needsMediaModerationReview(item);
  }
  if (statusFilter === "approved") {
    return item.moderationStatus === MediaModerationStatus.APPROVED && !item.hiddenByModeration;
  }
  return item.moderationStatus === MediaModerationStatus.REJECTED;
}

function previewUrlForProfileAsset(assetId: string) {
  return `/api/media/profile-image/${assetId}`;
}

function previewUrlForSingleOfWeekPhoto(photoId: string) {
  return `/api/media/single-of-week-photo/${photoId}`;
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; type?: string; status?: string; priority?: string; stale?: string }>;
}) {
  await requireAdmin();
  const resolvedSearchParams = await searchParams;
  const typeFilter = normalizeType(resolvedSearchParams?.type);
  const currentStatus = normalizeStatus(resolvedSearchParams?.status);
  const currentPriority = normalizePriority(resolvedSearchParams?.priority);
  const currentStale = normalizeStale(resolvedSearchParams?.stale);
  const now = new Date();

  const [profileAssets, singleOfWeekPhotos] = await Promise.all([
    prisma.userProfileImageAsset.findMany({
      orderBy: { uploadedAt: "asc" },
      take: 80,
      select: {
        id: true,
        uploadedAt: true,
        moderationStatus: true,
        moderationNote: true,
        hiddenByModeration: true,
        hiddenAt: true,
        hiddenReason: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            activityState: {
              select: {
                lastActiveAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.singleOfWeekApplicationPhoto.findMany({
      orderBy: { uploadedAt: "asc" },
      take: 80,
      select: {
        id: true,
        uploadedAt: true,
        moderationStatus: true,
        moderationNote: true,
        hiddenByModeration: true,
        hiddenAt: true,
        hiddenReason: true,
        application: {
          select: {
            id: true,
            status: true,
            applicant: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
            features: {
              orderBy: { publishAt: "desc" },
              take: 3,
              select: { status: true },
            },
          },
        },
      },
    }),
  ]);

  const ownerIds = Array.from(new Set([
    ...profileAssets.map((asset) => asset.user.id),
    ...singleOfWeekPhotos.map((photo) => photo.application.applicant.id),
  ]));
  await refreshUserTrustStates(prisma, ownerIds);
  const ownerTrustRows = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, trustTier: true, trustSummary: true },
  });
  const ownerTrustById = new Map(ownerTrustRows.map((entry) => [entry.id, formatTrustLabel(entry.trustTier, entry.trustSummary)]));

  const hiddenOwnerIds = Array.from(
    new Set(
      [
        ...profileAssets.filter((asset) => asset.hiddenByModeration).map((asset) => asset.user.id),
        ...singleOfWeekPhotos.filter((photo) => photo.hiddenByModeration).map((photo) => photo.application.applicant.id),
      ].filter(Boolean),
    ),
  );
  const hiddenSignalEntries = await Promise.all(
    hiddenOwnerIds.map(async (ownerUserId) => [ownerUserId, await getWeightedUserReportSignalSummary(prisma, ownerUserId)] as const),
  );
  const hiddenSignalSummaryByOwner = new Map(hiddenSignalEntries);

  const allItems: MediaQueueItem[] = [
    ...profileAssets.map((asset) => {
      const reviewStartedAt = getMediaReviewStartedAt({ uploadedAt: asset.uploadedAt, hiddenAt: asset.hiddenAt });
      const priority = getMediaQueuePriority({
        type: "profile",
        lastActiveAt: asset.user.activityState?.lastActiveAt,
        now,
      });
      return {
        key: `profile:${asset.id}`,
        id: asset.id,
        type: "profile" as const,
        ownerUserId: asset.user.id,
        displayName: asset.user.displayName,
        email: asset.user.email,
        uploadedAt: asset.uploadedAt,
        reviewStartedAt,
        moderationStatus: asset.moderationStatus,
        moderationNote: asset.moderationNote,
        hiddenByModeration: asset.hiddenByModeration,
        hiddenReason: asset.hiddenReason,
        priority,
        staleState: getMediaStaleState(reviewStartedAt, now),
        previewUrl: previewUrlForProfileAsset(asset.id),
        metaLabel: "Profile image",
        signalSummary: asset.hiddenByModeration ? hiddenSignalSummaryByOwner.get(asset.user.id) ?? null : null,
        ownerTrustLabel: ownerTrustById.get(asset.user.id) ?? "LOW",
      };
    }),
    ...singleOfWeekPhotos.map((photo) => {
      const reviewStartedAt = getMediaReviewStartedAt({ uploadedAt: photo.uploadedAt, hiddenAt: photo.hiddenAt });
      const priority = getMediaQueuePriority({
        type: "single-of-week",
        applicationStatus: photo.application.status,
        featureStatuses: photo.application.features.map((feature) => feature.status),
      });
      return {
        key: `single-of-week:${photo.id}`,
        id: photo.id,
        type: "single-of-week" as const,
        ownerUserId: photo.application.applicant.id,
        displayName: photo.application.applicant.displayName,
        email: photo.application.applicant.email,
        uploadedAt: photo.uploadedAt,
        reviewStartedAt,
        moderationStatus: photo.moderationStatus,
        moderationNote: photo.moderationNote,
        hiddenByModeration: photo.hiddenByModeration,
        hiddenReason: photo.hiddenReason,
        priority,
        staleState: getMediaStaleState(reviewStartedAt, now),
        previewUrl: previewUrlForSingleOfWeekPhoto(photo.id),
        metaLabel: `Single of the Week · ${photo.application.status}`,
        signalSummary: photo.hiddenByModeration ? hiddenSignalSummaryByOwner.get(photo.application.applicant.id) ?? null : null,
        ownerTrustLabel: ownerTrustById.get(photo.application.applicant.id) ?? "LOW",
      };
    }),
  ];

  const pendingItems = allItems.filter((item) => needsMediaModerationReview(item));
  const summary = {
    pendingTotal: pendingItems.length,
    stale24h: pendingItems.filter((item) => item.staleState === "over_24h" || item.staleState === "over_72h").length,
    stale72h: pendingItems.filter((item) => item.staleState === "over_72h").length,
  };

  const filteredItems = allItems
    .filter((item) => (typeFilter === "all" ? true : item.type === typeFilter))
    .filter((item) => matchesStatusFilter(item, currentStatus))
    .filter((item) => (currentPriority === "all" ? true : item.priority === currentPriority))
    .filter((item) => (currentStale === "stale" ? item.staleState !== "fresh" : true))
    .sort((left, right) => {
      const rankDifference = getMediaQueuePriorityRank(left.priority) - getMediaQueuePriorityRank(right.priority);
      if (rankDifference !== 0) {
        return rankDifference;
      }
      return left.reviewStartedAt.getTime() - right.reviewStartedAt.getTime();
    });

  return (
    <main className="space-y-6">
      <SavedMessageBanner saved={resolvedSearchParams?.saved} />
      <AdminPageIntro
        eyebrow="Media moderation"
        title="Operational media review"
        description="Review pending and auto-hidden profile images and featured photos in one queue. Priority, stale indicators, and bulk actions keep the backlog manageable without changing the underlying approval rules."
      />

      <section className="admin-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(90,76,66,0.36)] pb-5">
          <div>
            <p className="lux-overline text-[#a99687]">Queue overview</p>
            <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Operational moderation queue</h2>
          </div>
          <div className="grid gap-2 text-right text-xs uppercase tracking-[0.14em] text-[#8f7f72] sm:grid-cols-3 sm:text-left">
            <div className="admin-card px-4 py-3"><span>Pending total</span><div className="mt-2 text-lg font-semibold tracking-tight text-[#fff4ea]">{summary.pendingTotal}</div></div>
            <div className="admin-card px-4 py-3"><span>Stale &gt;24h</span><div className="mt-2 text-lg font-semibold tracking-tight text-[#fff4ea]">{summary.stale24h}</div></div>
            <div className="admin-card px-4 py-3"><span>Stale &gt;72h</span><div className="mt-2 text-lg font-semibold tracking-tight text-[#fff4ea]">{summary.stale72h}</div></div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { type: "all" }, "All media")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { type: "profile" }, "Profile images")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { type: "single-of-week" }, "Single of the Week")}
          </div>
          <div className="flex flex-wrap gap-2">
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { status: "pending" }, "Needs review")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { status: "approved" }, "Approved")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { status: "rejected" }, "Rejected")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { status: "all" }, "All statuses")}
          </div>
          <div className="flex flex-wrap gap-2">
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { priority: "all" }, "All priorities")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { priority: "urgent_featured" }, "Urgent featured")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { priority: "active_profile" }, "Active member profile")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { priority: "profile" }, "Profile")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { priority: "routine" }, "Routine")}
          </div>
          <div className="flex flex-wrap gap-2">
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { stale: "all" }, "All ages")}
            {filterLink({ type: typeFilter, status: currentStatus, priority: currentPriority, stale: currentStale }, { stale: "stale" }, "Stale only")}
          </div>
        </div>

        <form action={bulkReviewMediaAdminAction} className="mt-5 grid gap-3 rounded-[1.25rem] border border-[rgba(148,127,112,0.24)] bg-[rgba(41,33,29,0.72)] p-4" id="bulk-media-review-form">
          <input name="currentType" type="hidden" value={typeFilter} />
          <input name="currentStatus" type="hidden" value={currentStatus} />
          <input name="currentPriority" type="hidden" value={currentPriority} />
          <input name="currentStale" type="hidden" value={currentStale} />
          <div>
            <p className="text-sm font-medium text-[#fff4ea]">Bulk review</p>
            <p className="mt-1 text-xs text-[#bbaea1]">Select pending or auto-hidden items below, then approve or reject them together.</p>
          </div>
          <input className="admin-input" maxLength={500} name="moderationNote" placeholder="Optional shared moderation note" />
          <div className="flex flex-wrap gap-2">
            <button className="admin-button-primary" name="decision" type="submit" value="approve">Approve selected</button>
            <button className="admin-button-secondary" name="decision" type="submit" value="reject">Reject selected</button>
          </div>
        </form>
      </section>

      <section className="admin-surface p-6" data-testid="admin-media-review-queue">
        <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
          <p className="lux-overline text-[#a99687]">Queue</p>
          <h2 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-[#fff4ea]">Prioritized moderation work</h2>
        </div>
        <div className="mt-5 space-y-4">
          {filteredItems.length === 0 ? (
            <p className="admin-card text-sm text-[#bbaea1]">No media items match the current filters.</p>
          ) : (
            filteredItems.map((item) => {
              const needsReview = needsMediaModerationReview(item);
              const staleLabel = getMediaStaleLabel(item.staleState);
              const pendingAge = formatPendingAge(item.reviewStartedAt, now);
              const itemTypeLabel = item.type === "profile" ? "Profile image" : "Single of the Week photo";

              return (
                <article className="admin-card grid gap-4 md:grid-cols-[auto_120px_minmax(0,1fr)]" data-item-type={item.type} data-priority={item.priority} data-testid="admin-media-card" key={item.key}>
                  <div className="pt-1">
                    {needsReview ? (
                      <input form="bulk-media-review-form" name="selectedItems" type="checkbox" value={item.key} aria-label={`Select ${item.displayName} ${itemTypeLabel}`} />
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-[1.25rem] border border-[rgba(148,127,112,0.24)] bg-[rgba(41,33,29,0.92)]">
                    <img alt={`${item.displayName} ${itemTypeLabel}`} className="h-[120px] w-full object-cover" src={item.previewUrl} />
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{item.displayName}</p>
                        <p className="text-[#bbaea1]">{item.email}</p>
                        <p className="mt-2 text-xs leading-5 text-[#d7c8bb]">Trust {item.ownerTrustLabel}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="admin-pill">{item.moderationStatus}</span>
                        {item.hiddenByModeration ? <span className="admin-pill border-[rgba(194,110,110,0.34)] bg-[rgba(194,110,110,0.14)] text-[#ffd8d8]">AUTO_HIDDEN</span> : null}
                        <span className="admin-pill">{getMediaQueuePriorityLabel(item.priority)}</span>
                        {needsReview && item.staleState !== "fresh" ? <span className="admin-pill">{staleLabel}</span> : null}
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#8f7f72]">{item.metaLabel} · Uploaded {formatDateTime(item.uploadedAt)}{needsReview ? ` · Pending age ${pendingAge}` : ""}</p>
                    {item.hiddenReason ? <p className="text-sm text-[#f0ccc5]">Hidden reason: {item.hiddenReason}</p> : null}
                    {item.hiddenByModeration && item.signalSummary ? (
                      <div className="rounded-2xl border border-[rgba(194,110,110,0.22)] bg-[rgba(194,110,110,0.08)] px-3 py-2 text-xs text-[#f2ddd5]">
                        <p>{formatWeightedSignalSummary(item.signalSummary)}</p>
                        <p className="mt-1 text-[#d8b8af]">
                          Distinct reporters: {item.signalSummary.distinctReporterCount} | Contributing: {item.signalSummary.contributingReporterCount} | {formatWeightedSignalBreakdown(item.signalSummary)}
                        </p>
                      </div>
                    ) : null}
                    {item.moderationNote ? <p className="text-sm text-[#d7c8bb]">Note: {item.moderationNote}</p> : <p className="text-sm text-[#bbaea1]">No moderation note yet.</p>}
                    {needsReview ? (
                      <div className="flex flex-wrap gap-2">
                        {item.type === "profile" ? (
                          <>
                            <form action={reviewProfileImageAssetAdminAction} className="flex flex-wrap gap-2">
                              <input name="assetId" type="hidden" value={item.id} />
                              <input name="decision" type="hidden" value="approve" />
                              <input name="currentType" type="hidden" value={typeFilter} />
                              <input name="currentStatus" type="hidden" value={currentStatus} />
                              <input name="currentPriority" type="hidden" value={currentPriority} />
                              <input name="currentStale" type="hidden" value={currentStale} />
                              <input className="admin-input min-w-[220px]" maxLength={500} name="moderationNote" placeholder={item.hiddenByModeration ? "Optional re-approval note" : "Optional approval note"} />
                              <button className="admin-button-primary" type="submit">{item.hiddenByModeration ? "Approve and restore" : "Approve image"}</button>
                            </form>
                            <form action={reviewProfileImageAssetAdminAction} className="flex flex-wrap gap-2">
                              <input name="assetId" type="hidden" value={item.id} />
                              <input name="decision" type="hidden" value="reject" />
                              <input name="currentType" type="hidden" value={typeFilter} />
                              <input name="currentStatus" type="hidden" value={currentStatus} />
                              <input name="currentPriority" type="hidden" value={currentPriority} />
                              <input name="currentStale" type="hidden" value={currentStale} />
                              <input className="admin-input min-w-[220px]" maxLength={500} name="moderationNote" placeholder="Optional rejection reason" />
                              <button className="admin-button-secondary" type="submit">Reject image</button>
                            </form>
                          </>
                        ) : (
                          <>
                            <form action={reviewSingleOfWeekPhotoAdminAction} className="flex flex-wrap gap-2">
                              <input name="photoId" type="hidden" value={item.id} />
                              <input name="decision" type="hidden" value="approve" />
                              <input name="currentType" type="hidden" value={typeFilter} />
                              <input name="currentStatus" type="hidden" value={currentStatus} />
                              <input name="currentPriority" type="hidden" value={currentPriority} />
                              <input name="currentStale" type="hidden" value={currentStale} />
                              <input className="admin-input min-w-[220px]" maxLength={500} name="moderationNote" placeholder={item.hiddenByModeration ? "Optional re-approval note" : "Optional approval note"} />
                              <button className="admin-button-primary" type="submit">{item.hiddenByModeration ? "Approve and restore" : "Approve photo"}</button>
                            </form>
                            <form action={reviewSingleOfWeekPhotoAdminAction} className="flex flex-wrap gap-2">
                              <input name="photoId" type="hidden" value={item.id} />
                              <input name="decision" type="hidden" value="reject" />
                              <input name="currentType" type="hidden" value={typeFilter} />
                              <input name="currentStatus" type="hidden" value={currentStatus} />
                              <input name="currentPriority" type="hidden" value={currentPriority} />
                              <input name="currentStale" type="hidden" value={currentStale} />
                              <input className="admin-input min-w-[220px]" maxLength={500} name="moderationNote" placeholder="Optional rejection reason" />
                              <button className="admin-button-secondary" type="submit">Reject photo</button>
                            </form>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}


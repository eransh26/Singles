import Link from "next/link";
import { EventPromotionStatus, ReportTargetType, UserRole, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const savedMessages: Record<string, string> = {
  event: "Promoted event saved.",
  report: "Report review saved.",
  user: "User management update saved.",
  verification: "Verification review saved.",
  "admin-created": "Admin user created.",
  "buddy-domain": "Buddy domain saved.",
  "buddy-application-review": "Buddy application review saved.",
  "buddy-override": "Buddy re-application override granted.",
  config: "Single of the Week settings saved.",
  shortlisted: "Application shortlisted.",
  review: "Application review saved.",
  selected: "Single of the Week selection saved.",
  limits: "Featured request overrides saved.",
  hidden: "Featured member hidden from the home card.",
  "feature-flag": "Feature flag saved.",
  "media-moderation": "Media moderation saved.",
};

export const adminErrorMessages: Record<string, string> = {
  "admin-email-exists": "That email is already being used by another account. Choose a different email address.",
  "admin-invalid-email": "Enter a valid email address before creating the admin account.",
  "admin-invalid-name": "Display name must be between 2 and 80 characters.",
  "admin-invalid-password": "Temporary password must be at least 8 characters.",
  "admin-invalid-role": "Choose either ADMIN or SUPER_ADMIN for operational accounts.",
  "admin-create-failed": "We couldn't create that admin account. Please review the form and try again.",
};

export function formatDateTime(value: Date | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function formatDateTimeInput(value: Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function moderationOptionsForTarget(targetType: ReportTargetType) {
  switch (targetType) {
    case ReportTargetType.USER:
      return [{ value: "SUSPEND_USER", label: "Suspend user" }];
    case ReportTargetType.POST:
      return [{ value: "HIDE_POST", label: "Hide post" }];
    case ReportTargetType.COMMENT:
      return [{ value: "REMOVE_COMMENT", label: "Remove comment" }];
    case ReportTargetType.MESSAGE:
      return [{ value: "REMOVE_MESSAGE", label: "Remove message" }];
    case ReportTargetType.GROUP:
      return [{ value: "DISABLE_GROUP", label: "Disable group" }];
    default:
      return [];
  }
}

export function reportTargetCopy(report: {
  targetType: ReportTargetType;
  targetUser: { displayName: string; email: string } | null;
  targetPost: { contentText: string } | null;
  targetComment: { contentText: string } | null;
  targetMessage: { body: string } | null;
  targetGroup: { name: string } | null;
}) {
  switch (report.targetType) {
    case ReportTargetType.USER:
      return report.targetUser ? `${report.targetUser.displayName} (${report.targetUser.email})` : "User no longer available";
    case ReportTargetType.POST:
      return report.targetPost?.contentText ?? "Post no longer available";
    case ReportTargetType.COMMENT:
      return report.targetComment?.contentText ?? "Comment no longer available";
    case ReportTargetType.MESSAGE:
      return report.targetMessage?.body ?? "Message no longer available";
    case ReportTargetType.GROUP:
      return report.targetGroup?.name ?? "Group no longer available";
    default:
      return "Unknown target";
  }
}

export function AdminPageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="admin-surface overflow-hidden p-6 md:p-8">
      <p className="lux-overline text-[#aa9788]">{eyebrow}</p>
      <h1 className="mt-3 text-[2.35rem] font-semibold tracking-tight text-[#fff4ea] md:text-[3rem] md:leading-[1.08]">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bbae] md:text-[15px]">{description}</p>
    </section>
  );
}

export function SavedMessageBanner({ saved }: { saved?: string }) {
  const message = saved ? savedMessages[saved] : null;

  if (!message) {
    return null;
  }

  return (
    <div className="rounded-[1.25rem] border border-[rgba(184,197,166,0.28)] bg-[rgba(184,197,166,0.12)] px-4 py-3 text-sm text-[#dfe8d5]">
      {message}
    </div>
  );
}

export function AdminErrorBanner({ error }: { error?: string }) {
  const message = error ? adminErrorMessages[error] : null;

  if (!message) {
    return null;
  }

  return (
    <div className="rounded-[1.25rem] border border-[rgba(210,161,152,0.28)] bg-[rgba(210,161,152,0.12)] px-4 py-3 text-sm text-[#f0ccc5]">
      {message}
    </div>
  );
}

export async function getAdminDashboardData() {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  const [newUsers, previousNewUsers, memberUsers, adminUsers, recentPosts, pendingVerifications, openReports, activeEvents] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.user.count({ where: { role: UserRole.USER } }),
    prisma.user.count({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } } }),
    prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.verificationRequest.count({ where: { status: VerificationStatus.PENDING } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.eventPromotion.count({ where: { status: EventPromotionStatus.ACTIVE } }),
  ]);

  const growthLabel = previousNewUsers === 0 ? `${newUsers} this week` : `${newUsers - previousNewUsers >= 0 ? "+" : ""}${newUsers - previousNewUsers} vs last week`;

  return {
    memberUsers,
    adminUsers,
    cards: [
      { label: "New users", value: String(newUsers), helper: "Joined in the last 7 days" },
      { label: "User growth", value: growthLabel, helper: `${memberUsers + adminUsers} total accounts` },
      { label: "Member accounts", value: String(memberUsers), helper: "Community-facing member profiles" },
      { label: "Admin accounts", value: String(adminUsers), helper: "Operational admin-only accounts" },
      { label: "Post/activity stats", value: String(recentPosts), helper: "Posts created in the last 7 days" },
      { label: "Pending verifications", value: String(pendingVerifications), helper: "Awaiting admin review" },
      { label: "Open reports", value: String(openReports), helper: "Need moderation attention" },
      { label: "Promoted events summary", value: String(activeEvents), helper: "Currently active promotions" },
    ],
  };
}

export async function getAdminSidebarCounts() {
  const [memberUserCount, adminUserCount, pendingVerificationCount, openReportCount, activeEventCount, auditLogCount, buddyPendingCount, singleOfWeekPendingCount, pendingMediaCount] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.USER } }),
    prisma.user.count({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } } }),
    prisma.verificationRequest.count({ where: { status: VerificationStatus.PENDING } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.eventPromotion.count({ where: { status: EventPromotionStatus.ACTIVE } }),
    prisma.auditLog.count(),
    prisma.buddyApplicationDomain.count({ where: { status: { in: ["PENDING_RECOMMENDATIONS", "REPLACEMENT_NEEDED", "PENDING_ADMIN_REVIEW"] } } }),
    prisma.singleOfWeekApplication.count({ where: { status: { in: ["SUBMITTED", "SHORTLISTED", "SELECTED"] } } }),
    prisma.userProfileImageAsset.count({ where: { moderationStatus: "PENDING_REVIEW" } }).then((count) =>
      prisma.singleOfWeekApplicationPhoto.count({ where: { moderationStatus: "PENDING_REVIEW" } }).then((photoCount) => count + photoCount),
    ),
  ]);

  return {
    memberUserCount,
    adminUserCount,
    pendingVerificationCount,
    openReportCount,
    activeEventCount,
    auditLogCount,
    buddyPendingCount,
    singleOfWeekPendingCount,
    pendingMediaCount,
  };
}

export async function getUsersByTab(tab: "members" | "operators") {
  const roles = tab === "operators" ? [UserRole.ADMIN, UserRole.SUPER_ADMIN] : [UserRole.USER];

  return prisma.user.findMany({
    where: { role: { in: roles } },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      accountStatus: true,
      verificationStatus: true,
      isTestUser: true,
      createdAt: true,
    },
  });
}

export async function getPendingVerificationRequests() {
  return prisma.verificationRequest.findMany({
    where: { status: VerificationStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          emailVerified: true,
          phoneVerifiedAt: true,
          ageVerified: true,
        },
      },
    },
  });
}

export async function getOpenReports() {
  return prisma.report.findMany({
    where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: {
      id: true,
      reasonCode: true,
      details: true,
      status: true,
      targetType: true,
      createdAt: true,
      filedBy: { select: { displayName: true, email: true } },
      targetUser: { select: { displayName: true, email: true } },
      targetPost: { select: { contentText: true } },
      targetComment: { select: { contentText: true } },
      targetMessage: { select: { body: true } },
      targetGroup: { select: { name: true } },
    },
  });
}

export async function getPromotedEvents() {
  return prisma.eventPromotion.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      externalLink: true,
      couponCode: true,
      status: true,
      startsAt: true,
      endsAt: true,
      placements: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          placementType: true,
          groupId: true,
          priority: true,
        },
      },
    },
  });
}

export async function getRecentAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      createdAt: true,
      metadataJson: true,
      actor: { select: { email: true } },
    },
  });
}

export async function getActiveGroups() {
  return prisma.group.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function AdminQuickLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link className="admin-card transition hover:border-[rgba(201,167,110,0.34)] hover:bg-[rgba(43,36,31,0.92)]" href={href}>
      <p className="lux-overline text-[#aa9788]">Open</p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-[#fff4ea]">{label}</p>
      <p className="mt-3 text-sm leading-6 text-[#bbaea1]">{hint}</p>
    </Link>
  );
}





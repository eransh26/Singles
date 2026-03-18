"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AccountStatus,
  EventPromotionStatus,
  GroupStatus,
  ModerationStatus,
  PlacementType,
  PostVisibilityStatus,
  ReportStatus,
  ReportTargetType,
  UserRole,
  VerificationStatus,
} from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalTextValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseDateTimeValue(formData: FormData, key: string) {
  const value = optionalTextValue(formData, key);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${key} value.`);
  }

  return parsed;
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function ensureAdminRole(role: UserRole) {
  if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
    throw new Error("Admin accounts must use an admin role.");
  }
}

function reportActionOptions(targetType: ReportTargetType) {
  switch (targetType) {
    case ReportTargetType.USER:
      return ["NONE", "SUSPEND_USER"] as const;
    case ReportTargetType.POST:
      return ["NONE", "HIDE_POST"] as const;
    case ReportTargetType.COMMENT:
      return ["NONE", "REMOVE_COMMENT"] as const;
    case ReportTargetType.MESSAGE:
      return ["NONE", "REMOVE_MESSAGE"] as const;
    case ReportTargetType.GROUP:
      return ["NONE", "DISABLE_GROUP"] as const;
    default:
      return ["NONE"] as const;
  }
}

export async function createAdminUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const displayName = textValue(formData, "displayName");
  const email = textValue(formData, "email").toLowerCase();
  const password = textValue(formData, "password");
  const role = textValue(formData, "role") as UserRole;
  const accountStatus = textValue(formData, "accountStatus") as AccountStatus;
  const isTestUser = booleanValue(formData, "isTestUser");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/admin/operators?error=admin-invalid-email");
  }

  if (displayName.length < 2 || displayName.length > 80) {
    redirect("/admin/operators?error=admin-invalid-name");
  }

  if (password.length < 8) {
    redirect("/admin/operators?error=admin-invalid-password");
  }

  try {
    ensureAdminRole(role);
  } catch {
    redirect("/admin/operators?error=admin-invalid-role");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    redirect("/admin/operators?error=admin-email-exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let createdUser;

  try {
    createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        role,
        accountStatus,
        isTestUser,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "admin.user.created",
        targetType: "User",
        targetId: user.id,
        metadataJson: {
          email,
          displayName,
          role,
          accountStatus,
          isTestUser,
        },
      },
    });

    return user;
    });
  } catch {
    redirect("/admin/operators?error=admin-create-failed");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/operators");
  revalidatePath("/admin/audit-logs");
  redirect(`/admin/operators?expanded=${createdUser.id}&saved=admin-created`);
}

export async function updateAdminUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const targetUserId = textValue(formData, "targetUserId");
  const accountStatus = textValue(formData, "accountStatus") as AccountStatus;
  const role = textValue(formData, "role") as UserRole;
  const currentSection = textValue(formData, "currentSection");
  const isTestUser = booleanValue(formData, "isTestUser");

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, accountStatus: true, isTestUser: true },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  if (
    targetUser.id === admin.id &&
    (accountStatus !== AccountStatus.ACTIVE || (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN))
  ) {
    throw new Error("You cannot remove your own admin access or suspend yourself.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUser.id },
      data: {
        accountStatus,
        role,
        isTestUser,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "admin.user.updated",
        targetType: "User",
        targetId: targetUser.id,
        metadataJson: {
          previousRole: targetUser.role,
          nextRole: role,
          previousAccountStatus: targetUser.accountStatus,
          nextAccountStatus: accountStatus,
          previousIsTestUser: targetUser.isTestUser,
          nextIsTestUser: isTestUser,
        },
      },
    });
  });

  const destinationSection =
    role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN
      ? "operators"
      : currentSection === "operators"
        ? "operators"
        : "users";

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/operators");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/home");
  redirect(`/admin/${destinationSection}?expanded=${targetUser.id}&saved=user`);
}

export async function reviewVerificationRequestAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = textValue(formData, "requestId");
  const decision = textValue(formData, "decision");

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      status: true,
      user: {
        select: {
          displayName: true,
          emailVerified: true,
          phoneVerifiedAt: true,
          ageVerified: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!request || request.status !== VerificationStatus.PENDING) {
    throw new Error("Verification request not found.");
  }

  if (decision === "approve") {
    const hasPrerequisites = Boolean(request.user.emailVerified && request.user.phoneVerifiedAt && request.user.ageVerified);
    if (!hasPrerequisites) {
      throw new Error("This request cannot be approved until email, phone, and 18+ checks are all satisfied.");
    }
  }

  const nextStatus = decision === "approve" ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;

  await prisma.$transaction(async (tx) => {
    await tx.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: request.userId },
      data: {
        verificationStatus: nextStatus,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: `admin.verification.${decision === "approve" ? "approved" : "rejected"}`,
        targetType: "VerificationRequest",
        targetId: request.id,
        metadataJson: {
          subjectUserId: request.userId,
          subjectDisplayName: request.user.displayName,
          nextStatus,
        },
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/verifications");
  revalidatePath("/admin/users");
  revalidatePath("/admin/operators");
  revalidatePath("/admin/audit-logs");
  redirect("/admin/verifications?saved=verification");
}

export async function resolveReportAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const reportId = textValue(formData, "reportId");
  const decision = textValue(formData, "decision");
  const moderationAction = textValue(formData, "moderationAction");

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetType: true,
      targetUserId: true,
      targetPostId: true,
      targetCommentId: true,
      targetMessageId: true,
      targetGroupId: true,
      status: true,
      targetPost: { select: { id: true, groupId: true, contentText: true } },
      targetComment: { select: { id: true, postId: true, contentText: true } },
      targetMessage: { select: { id: true, conversationId: true, body: true } },
      targetGroup: { select: { id: true, name: true } },
      targetUser: { select: { id: true, email: true, displayName: true } },
    },
  });

  if (!report || (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.IN_REVIEW)) {
    throw new Error("Report not found.");
  }

  if (!reportActionOptions(report.targetType).includes(moderationAction as never)) {
    throw new Error("Moderation action is not valid for this report.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: {
        status: decision === "resolve" ? ReportStatus.RESOLVED : ReportStatus.REJECTED,
        resolvedByUserId: admin.id,
        resolvedAt: new Date(),
      },
    });

    if (decision === "resolve") {
      switch (moderationAction) {
        case "HIDE_POST":
          if (!report.targetPostId) {
            throw new Error("This report is not linked to a post.");
          }
          await tx.post.update({
            where: { id: report.targetPostId },
            data: {
              visibilityStatus: PostVisibilityStatus.HIDDEN,
              moderationStatus: ModerationStatus.REMOVED,
            },
          });
          break;
        case "REMOVE_COMMENT":
          if (!report.targetCommentId) {
            throw new Error("This report is not linked to a comment.");
          }
          await tx.comment.update({
            where: { id: report.targetCommentId },
            data: {
              moderationStatus: ModerationStatus.REMOVED,
            },
          });
          break;
        case "REMOVE_MESSAGE":
          if (!report.targetMessageId) {
            throw new Error("This report is not linked to a message.");
          }
          await tx.message.update({
            where: { id: report.targetMessageId },
            data: {
              deletedAt: new Date(),
            },
          });
          break;
        case "DISABLE_GROUP":
          if (!report.targetGroupId) {
            throw new Error("This report is not linked to a group.");
          }
          await tx.group.update({
            where: { id: report.targetGroupId },
            data: {
              status: GroupStatus.DISABLED,
            },
          });
          break;
        case "SUSPEND_USER":
          if (!report.targetUserId) {
            throw new Error("This report is not linked to a user.");
          }
          await tx.user.update({
            where: { id: report.targetUserId },
            data: {
              accountStatus: AccountStatus.SUSPENDED,
            },
          });
          break;
        default:
          break;
      }
    }

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: decision === "resolve" ? "admin.report.resolved" : "admin.report.rejected",
        targetType: "Report",
        targetId: report.id,
        metadataJson: {
          moderationAction,
          targetType: report.targetType,
          targetUserId: report.targetUserId,
          targetPostId: report.targetPostId,
          targetCommentId: report.targetCommentId,
          targetMessageId: report.targetMessageId,
          targetGroupId: report.targetGroupId,
        },
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/home");
  revalidatePath("/groups");
  revalidatePath("/chats");
  redirect("/admin/reports?saved=report");
}

export async function savePromotedEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const eventPromotionId = optionalTextValue(formData, "eventPromotionId");
  const title = textValue(formData, "title");
  const description = optionalTextValue(formData, "description");
  const imageUrl = optionalTextValue(formData, "imageUrl");
  const externalLink = textValue(formData, "externalLink");
  const couponCode = optionalTextValue(formData, "couponCode");
  const status = textValue(formData, "status") as EventPromotionStatus;
  const startsAt = parseDateTimeValue(formData, "startsAt");
  const endsAt = parseDateTimeValue(formData, "endsAt");
  const placementType = textValue(formData, "placementType") as PlacementType;
  const groupId = optionalTextValue(formData, "groupId");
  const priority = Number(textValue(formData, "priority") || "0");

  if (title.length < 3) {
    throw new Error("Event title must be at least 3 characters.");
  }

  if (!externalLink) {
    throw new Error("External link is required.");
  }

  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error("Event end must be after the start time.");
  }

  if (placementType === PlacementType.GROUP_DETAIL_BANNER && !groupId) {
    throw new Error("Choose a group when using the group detail banner placement.");
  }

  const savedEvent = await prisma.$transaction(async (tx) => {
    const event = eventPromotionId
      ? await tx.eventPromotion.update({
          where: { id: eventPromotionId },
          data: {
            title,
            description,
            imageUrl,
            externalLink,
            couponCode,
            status,
            startsAt,
            endsAt,
          },
          select: { id: true },
        })
      : await tx.eventPromotion.create({
          data: {
            title,
            description,
            imageUrl,
            externalLink,
            couponCode,
            status,
            startsAt,
            endsAt,
            createdByUserId: admin.id,
          },
          select: { id: true },
        });

    await tx.eventPromotionPlacement.deleteMany({
      where: { eventPromotionId: event.id },
    });

    await tx.eventPromotionPlacement.create({
      data: {
        eventPromotionId: event.id,
        placementType,
        groupId,
        priority: Number.isNaN(priority) ? 0 : priority,
        isActive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: eventPromotionId ? "admin.event.updated" : "admin.event.created",
        targetType: "EventPromotion",
        targetId: event.id,
        metadataJson: {
          placementType,
          groupId,
          status,
          priority: Number.isNaN(priority) ? 0 : priority,
        },
      },
    });

    return event;
  });

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/home");
  revalidatePath("/groups");
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
  }
  redirect(`/admin/events?saved=event&eventId=${savedEvent.id}`);
}


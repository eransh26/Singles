"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SingleOfWeekApplicationStatus, SingleOfWeekFeatureStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  ensureSingleOfWeekConfig,
  getSingleOfWeekNotifyAt,
  getSingleOfWeekPublishAt,
  getUpcomingSunday,
  normalizeWeekOf,
} from "@/lib/single-of-the-week";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalNumber(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${key} must be a positive number.`);
  }
  return number;
}

function revalidateAdminSinglePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/single-of-the-week");
  revalidatePath("/home");
  revalidatePath("/single-of-the-week");
}

export async function saveSingleOfWeekConfigAdminAction(formData: FormData) {
  await requireAdmin();
  const targetDailyCap = optionalNumber(formData, "targetDailyCap");
  const targetWeeklyCap = optionalNumber(formData, "targetWeeklyCap");
  const targetMonthlyCap = optionalNumber(formData, "targetMonthlyCap");
  const requesterDailyCap = optionalNumber(formData, "requesterDailyCap");
  const requesterWeeklyCap = optionalNumber(formData, "requesterWeeklyCap");
  const requesterMonthlyCap = optionalNumber(formData, "requesterMonthlyCap");

  await prisma.singleOfWeekConfig.upsert({
    where: { id: "default" },
    update: {
      targetDailyCap: targetDailyCap ?? 10,
      targetWeeklyCap: targetWeeklyCap ?? 20,
      targetMonthlyCap: targetMonthlyCap ?? 50,
      requesterDailyCap: requesterDailyCap ?? 3,
      requesterWeeklyCap: requesterWeeklyCap ?? 6,
      requesterMonthlyCap: requesterMonthlyCap ?? 12,
    },
    create: {
      id: "default",
      targetDailyCap: targetDailyCap ?? 10,
      targetWeeklyCap: targetWeeklyCap ?? 20,
      targetMonthlyCap: targetMonthlyCap ?? 50,
      requesterDailyCap: requesterDailyCap ?? 3,
      requesterWeeklyCap: requesterWeeklyCap ?? 6,
      requesterMonthlyCap: requesterMonthlyCap ?? 12,
    },
  });

  revalidateAdminSinglePaths();
  redirect("/admin/single-of-the-week?saved=config");
}

export async function shortlistSingleOfWeekApplicationAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const applicationId = textValue(formData, "applicationId");
  const score = optionalNumber(formData, "score");

  await prisma.singleOfWeekApplication.update({
    where: { id: applicationId },
    data: {
      status: SingleOfWeekApplicationStatus.SHORTLISTED,
      shortlistedAt: new Date(),
      shortlistScore: score ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "admin.single_of_week.shortlisted",
      targetType: "SingleOfWeekApplication",
      targetId: applicationId,
      metadataJson: { score },
    },
  });

  revalidateAdminSinglePaths();
  redirect("/admin/single-of-the-week?saved=shortlisted");
}

export async function reviewSingleOfWeekApplicationAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const applicationId = textValue(formData, "applicationId");
  const decision = textValue(formData, "decision");
  const adminNotes = textValue(formData, "adminNotes");

  const nextStatus = decision === "reject" ? SingleOfWeekApplicationStatus.REJECTED : SingleOfWeekApplicationStatus.SHORTLISTED;

  await prisma.singleOfWeekApplication.update({
    where: { id: applicationId },
    data: {
      status: nextStatus,
      adminNotes: adminNotes || null,
      rejectedAt: nextStatus === SingleOfWeekApplicationStatus.REJECTED ? new Date() : null,
      shortlistedAt: nextStatus === SingleOfWeekApplicationStatus.SHORTLISTED ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: nextStatus === SingleOfWeekApplicationStatus.REJECTED ? "admin.single_of_week.rejected" : "admin.single_of_week.reviewed",
      targetType: "SingleOfWeekApplication",
      targetId: applicationId,
      metadataJson: { adminNotes, nextStatus },
    },
  });

  revalidateAdminSinglePaths();
  redirect("/admin/single-of-the-week?saved=review");
}

export async function selectSingleOfWeekApplicationAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const applicationId = textValue(formData, "applicationId");
  const requestedWeekOf = textValue(formData, "weekOf");
  const weekOf = requestedWeekOf ? normalizeWeekOf(new Date(requestedWeekOf)) : getUpcomingSunday();
  const publishAt = getSingleOfWeekPublishAt(weekOf);
  const notifyAt = getSingleOfWeekNotifyAt(weekOf);

  await ensureSingleOfWeekConfig();

  await prisma.$transaction(async (tx) => {
    const application = await tx.singleOfWeekApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, applicantUserId: true, status: true },
    });

    if (!application || (application.status !== SingleOfWeekApplicationStatus.SUBMITTED && application.status !== SingleOfWeekApplicationStatus.SHORTLISTED)) {
      throw new Error("Application is not ready to be selected.");
    }

    await tx.singleOfWeekFeature.upsert({
      where: { weekOf },
      update: {
        applicationId: application.id,
        featuredUserId: application.applicantUserId,
        selectedByAdminId: admin.id,
        publishAt,
        notifyAt,
        status: SingleOfWeekFeatureStatus.UPCOMING,
        hiddenAt: null,
        hiddenReason: null,
        declinedAt: null,
        acceptedAt: null,
        respondedByUserId: null,
        completedAt: null,
      },
      create: {
        applicationId: application.id,
        featuredUserId: application.applicantUserId,
        weekOf,
        publishAt,
        notifyAt,
        status: SingleOfWeekFeatureStatus.UPCOMING,
        selectedByAdminId: admin.id,
      },
    });

    await tx.singleOfWeekApplication.update({
      where: { id: application.id },
      data: {
        status: SingleOfWeekApplicationStatus.SELECTED,
        selectedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "admin.single_of_week.selected",
        targetType: "SingleOfWeekApplication",
        targetId: application.id,
        metadataJson: { weekOf: weekOf.toISOString() },
      },
    });
  });

  revalidateAdminSinglePaths();
  redirect("/admin/single-of-the-week?saved=selected");
}

export async function saveSingleOfWeekFeatureCapsAdminAction(formData: FormData) {
  await requireAdmin();
  const featureId = textValue(formData, "featureId");
  const dailyCap = optionalNumber(formData, "dailyCap");
  const weeklyCap = optionalNumber(formData, "weeklyCap");
  const monthlyCap = optionalNumber(formData, "monthlyCap");

  await prisma.singleOfWeekFeatureLimitOverride.upsert({
    where: { featureId },
    update: { dailyCap, weeklyCap, monthlyCap },
    create: { featureId, dailyCap, weeklyCap, monthlyCap },
  });

  revalidateAdminSinglePaths();
  redirect("/admin/single-of-the-week?saved=limits");
}

export async function hideSingleOfWeekFeatureAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const featureId = textValue(formData, "featureId");
  const hiddenReason = textValue(formData, "hiddenReason") || "Hidden by admin after review.";

  await prisma.singleOfWeekFeature.update({
    where: { id: featureId },
    data: {
      status: SingleOfWeekFeatureStatus.HIDDEN,
      hiddenAt: new Date(),
      hiddenReason,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "admin.single_of_week.hidden",
      targetType: "SingleOfWeekFeature",
      targetId: featureId,
      metadataJson: { hiddenReason },
    },
  });

  revalidateAdminSinglePaths();
  redirect("/admin/single-of-the-week?saved=hidden");
}

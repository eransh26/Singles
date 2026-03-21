"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BuddyApplicationDomainStatus,
  BuddyApplicationStatus,
  BuddyAvailabilityLevel,
  BuddyRecommendationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  BUDDY_MAX_TEXT_LENGTH,
  BUDDY_RECOMMENDATION_MAX_NOTE_LENGTH,
  countBuddyDomainRejectedAttempts,
  ensureBuddyDomainsSeeded,
  getEligibleBuddyRecommenders,
  hasBuddyReapplicationOverride,
  isBuddyVerifiedUser,
  syncBuddyApplicationDomainStatus,
} from "@/lib/buddy";
import { createNotificationRecord, deliverNotifications } from "@/lib/notifications";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";

async function assertBuddyFeatureEnabled(user: { id: string; role?: unknown }) {
  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.buddy, user as never))) {
    throw new Error("Buddy is currently unavailable.");
  }
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isBuddyAvailabilityLevel(value: string): value is BuddyAvailabilityLevel {
  return Object.values(BuddyAvailabilityLevel).includes(value as BuddyAvailabilityLevel);
}

function revalidateBuddyApplicationPaths() {
  revalidatePath("/settings");
  revalidatePath("/buddy");
  revalidatePath("/admin");
  revalidatePath("/admin/buddy");
  revalidatePath("/notifications");
}

async function createNotification(tx: Prisma.TransactionClient, userId: string, type: NotificationType, payloadJson: Prisma.InputJsonValue) {
  return createNotificationRecord(tx, userId, type, payloadJson);
}

export async function createBuddyApplicationAction(formData: FormData) {
  const user = await requireActiveUser();
  await assertBuddyFeatureEnabled(user);
  await ensureBuddyDomainsSeeded();

  if (!isBuddyVerifiedUser(user)) {
    throw new Error("Complete email and phone verification before applying to become a Buddy.");
  }

  const intro = textValue(formData, "buddyIntro");
  const availabilityLevelValue = textValue(formData, "buddyAvailabilityLevel");
  const selectedDomainIds = Array.from(new Set(formData.getAll("domainIds").map((value) => String(value)).filter(Boolean)));

  if (intro.length === 0 || intro.length > BUDDY_MAX_TEXT_LENGTH) {
    throw new Error(`Buddy intro must be between 1 and ${BUDDY_MAX_TEXT_LENGTH} characters.`);
  }

  if (!isBuddyAvailabilityLevel(availabilityLevelValue)) {
    throw new Error("Choose an availability level.");
  }

  if (selectedDomainIds.length === 0) {
    throw new Error("Choose at least one Buddy domain.");
  }

  const existingActiveApplication = await prisma.buddyApplication.findFirst({
    where: { applicantUserId: user.id, status: BuddyApplicationStatus.ACTIVE },
    select: { id: true },
  });

  if (existingActiveApplication) {
    redirect("/settings?saved=buddy-application-active#buddy-setup");
  }

  const notificationIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const activeDomains = await tx.buddyDomainRecord.findMany({
      where: { id: { in: selectedDomainIds }, isActive: true },
      select: { id: true, name: true },
    });

    if (activeDomains.length !== selectedDomainIds.length) {
      throw new Error("One or more Buddy domains are no longer available.");
    }

    const eligibleRecommenders = await getEligibleBuddyRecommenders(tx, user.id);
    const eligibleIds = new Set(eligibleRecommenders.map((entry) => entry.id));

    for (const domain of activeDomains) {
      const recommenderIds = Array.from(new Set(formData.getAll(`recommendation-${domain.id}`).map((value) => String(value)).filter(Boolean)));
      if (recommenderIds.length !== 2) {
        throw new Error(`Choose 2 verified connections for ${domain.name}.`);
      }

      for (const recommenderId of recommenderIds) {
        if (!eligibleIds.has(recommenderId)) {
          throw new Error("Recommendations can only be requested from verified members you already know through approved chat.");
        }
      }

      const rejectedAttempts = await countBuddyDomainRejectedAttempts(tx, user.id, domain.id);
      const hasOverride = await hasBuddyReapplicationOverride(tx, user.id, domain.id);
      if (rejectedAttempts >= 3 && !hasOverride) {
        throw new Error(`${domain.name} has reached the application limit. An admin must unlock further applications for that domain.`);
      }
    }

    const application = await tx.buddyApplication.create({
      data: {
        applicantUserId: user.id,
        intro,
        availabilityLevel: availabilityLevelValue,
      },
      select: { id: true },
    });

    for (const domain of activeDomains) {
      const applicationDomain = await tx.buddyApplicationDomain.create({
        data: {
          applicationId: application.id,
          domainId: domain.id,
        },
        select: { id: true },
      });

      const recommenderIds = Array.from(new Set(formData.getAll(`recommendation-${domain.id}`).map((value) => String(value)).filter(Boolean)));

      await tx.buddyApplicationRecommendation.createMany({
        data: recommenderIds.map((recommenderUserId) => ({
          applicationDomainId: applicationDomain.id,
          recommenderUserId,
          status: BuddyRecommendationStatus.PENDING,
        })),
      });

      for (const recommenderUserId of recommenderIds) {
        const notification = await createNotification(tx, recommenderUserId, NotificationType.SYSTEM, {
          kind: "buddy_recommendation_requested",
          applicationId: application.id,
          applicationDomainId: applicationDomain.id,
          applicantDisplayName: user.displayName,
          domainName: domain.name,
          path: "/buddy",
        });
        notificationIds.push(notification.id);
      }
    }
  });

  await deliverNotifications(notificationIds);
  revalidateBuddyApplicationPaths();
  redirect("/settings?saved=buddy-application-submitted#buddy-setup");
}

export async function submitBuddyRecommendationAction(formData: FormData) {
  const user = await requireActiveUser();
  await assertBuddyFeatureEnabled(user);
  const recommendationId = textValue(formData, "recommendationId");
  const decision = textValue(formData, "decision");
  const note = textValue(formData, "note");

  if (!["approve", "decline"].includes(decision)) {
    throw new Error("Choose approve or decline.");
  }

  if (note.length > BUDDY_RECOMMENDATION_MAX_NOTE_LENGTH) {
    throw new Error(`Recommendation notes must be ${BUDDY_RECOMMENDATION_MAX_NOTE_LENGTH} characters or fewer.`);
  }

  await prisma.$transaction(async (tx) => {
    const recommendation = await tx.buddyApplicationRecommendation.findUnique({
      where: { id: recommendationId },
      select: {
        id: true,
        recommenderUserId: true,
        status: true,
        submittedAt: true,
        replacedAt: true,
        applicationDomainId: true,
      },
    });

    if (!recommendation || recommendation.recommenderUserId != user.id || recommendation.replacedAt) {
      throw new Error("Recommendation not found.");
    }

    if (recommendation.submittedAt || recommendation.status !== BuddyRecommendationStatus.PENDING) {
      throw new Error("This recommendation has already been submitted.");
    }

    await tx.buddyApplicationRecommendation.update({
      where: { id: recommendation.id },
      data: {
        status: decision === "approve" ? BuddyRecommendationStatus.APPROVED : BuddyRecommendationStatus.DECLINED,
        note: note || null,
        submittedAt: new Date(),
      },
    });

    await syncBuddyApplicationDomainStatus(tx, recommendation.applicationDomainId);
  });

  revalidateBuddyApplicationPaths();
  redirect("/buddy?saved=buddy-recommendation-submitted");
}

export async function replaceBuddyRecommenderAction(formData: FormData) {
  const user = await requireActiveUser();
  await assertBuddyFeatureEnabled(user);
  const applicationDomainId = textValue(formData, "applicationDomainId");
  const recommenderUserId = textValue(formData, "recommenderUserId");

  await prisma.$transaction(async (tx) => {
    const applicationDomain = await tx.buddyApplicationDomain.findUnique({
      where: { id: applicationDomainId },
      select: {
        id: true,
        status: true,
        application: { select: { applicantUserId: true, status: true } },
        recommendations: {
          where: { replacedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, recommenderUserId: true },
        },
      },
    });

    if (!applicationDomain || applicationDomain.application.applicantUserId !== user.id) {
      throw new Error("Buddy application domain not found.");
    }

    if (applicationDomain.application.status !== BuddyApplicationStatus.ACTIVE || applicationDomain.status !== BuddyApplicationDomainStatus.REPLACEMENT_NEEDED) {
      throw new Error("A replacement recommender is not needed here.");
    }

    const eligible = await getEligibleBuddyRecommenders(tx, user.id);
    if (!eligible.some((entry) => entry.id === recommenderUserId)) {
      throw new Error("Choose a verified connection you already know through approved chat.");
    }

    if (applicationDomain.recommendations.some((entry) => entry.recommenderUserId === recommenderUserId)) {
      throw new Error("Choose a different recommender for this domain.");
    }

    const declinedRecommendation = applicationDomain.recommendations.find((entry) => entry.status === BuddyRecommendationStatus.DECLINED);
    if (!declinedRecommendation) {
      throw new Error("No declined recommendation is waiting to be replaced.");
    }

    await tx.buddyApplicationRecommendation.update({
      where: { id: declinedRecommendation.id },
      data: { replacedAt: new Date() },
    });

    await tx.buddyApplicationRecommendation.create({
      data: {
        applicationDomainId: applicationDomain.id,
        recommenderUserId,
        status: BuddyRecommendationStatus.PENDING,
      },
    });

    await syncBuddyApplicationDomainStatus(tx, applicationDomain.id);
  });

  revalidateBuddyApplicationPaths();
  redirect("/settings?saved=buddy-recommender-replaced#buddy-setup");
}

export async function cancelBuddyApplicationAction(formData: FormData) {
  const user = await requireActiveUser();
  await assertBuddyFeatureEnabled(user);
  const applicationId = textValue(formData, "applicationId");

  await prisma.$transaction(async (tx) => {
    const application = await tx.buddyApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, applicantUserId: true, status: true },
    });

    if (!application || application.applicantUserId !== user.id) {
      throw new Error("Buddy application not found.");
    }

    if (application.status !== BuddyApplicationStatus.ACTIVE) {
      throw new Error("This Buddy application can no longer be cancelled.");
    }

    await tx.buddyApplication.update({
      where: { id: application.id },
      data: {
        status: BuddyApplicationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await tx.buddyApplicationDomain.updateMany({
      where: {
        applicationId: application.id,
        status: {
          in: [
            BuddyApplicationDomainStatus.PENDING_RECOMMENDATIONS,
            BuddyApplicationDomainStatus.REPLACEMENT_NEEDED,
            BuddyApplicationDomainStatus.PENDING_ADMIN_REVIEW,
          ],
        },
      },
      data: { status: BuddyApplicationDomainStatus.CANCELLED },
    });
  });

  revalidateBuddyApplicationPaths();
  redirect("/settings?saved=buddy-application-cancelled#buddy-setup");
}

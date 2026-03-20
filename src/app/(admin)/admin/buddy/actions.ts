"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  approveBuddyApplicationDomain,
  ensureBuddyDomainsSeeded,
  rejectBuddyApplicationDomain,
} from "@/lib/buddy";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalTextValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function revalidateBuddyAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/buddy");
  revalidatePath("/settings");
  revalidatePath("/buddy");
}

export async function saveBuddyDomainAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  await ensureBuddyDomainsSeeded();
  const buddyDomainId = optionalTextValue(formData, "buddyDomainId");
  const name = textValue(formData, "name");
  const description = optionalTextValue(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (name.length < 3 || name.length > 120) {
    throw new Error("Buddy domain names must be between 3 and 120 characters.");
  }

  const slug = slugify(name);
  if (!slug) {
    throw new Error("Buddy domain name must include letters or numbers.");
  }

  await prisma.$transaction(async (tx) => {
    if (buddyDomainId) {
      await tx.buddyDomainRecord.update({
        where: { id: buddyDomainId },
        data: { name, slug, description, isActive },
      });
    } else {
      await tx.buddyDomainRecord.create({
        data: { name, slug, description, isActive },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: buddyDomainId ? "admin.buddy-domain.updated" : "admin.buddy-domain.created",
        targetType: "BuddyDomainRecord",
        targetId: buddyDomainId ?? slug,
        metadataJson: { name, slug, isActive },
      },
    });
  });

  revalidateBuddyAdmin();
  redirect("/admin/buddy?saved=buddy-domain");
}

export async function reviewBuddyApplicationDomainAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const applicationDomainId = textValue(formData, "applicationDomainId");
  const decision = textValue(formData, "decision");

  await prisma.$transaction(async (tx) => {
    if (decision === "approve") {
      await approveBuddyApplicationDomain(tx, applicationDomainId, admin.id);
    } else {
      await rejectBuddyApplicationDomain(tx, applicationDomainId, admin.id);
    }

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: decision === "approve" ? "admin.buddy-application.approved" : "admin.buddy-application.rejected",
        targetType: "BuddyApplicationDomain",
        targetId: applicationDomainId,
      },
    });
  });

  revalidateBuddyAdmin();
  redirect("/admin/buddy?saved=buddy-application-review");
}

export async function grantBuddyReapplicationOverrideAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = textValue(formData, "userId");
  const domainId = textValue(formData, "domainId");

  await prisma.$transaction(async (tx) => {
    await tx.buddyReapplicationOverride.upsert({
      where: { userId_domainId: { userId, domainId } },
      update: { isActive: true, grantedByAdminId: admin.id },
      create: { userId, domainId, grantedByAdminId: admin.id, isActive: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "admin.buddy-domain.override-granted",
        targetType: "BuddyReapplicationOverride",
        targetId: `${userId}:${domainId}`,
        metadataJson: { userId, domainId },
      },
    });
  });

  revalidateBuddyAdmin();
  redirect("/admin/buddy?saved=buddy-override");
}

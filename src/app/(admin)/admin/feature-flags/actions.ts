"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeatureFlagRolloutType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultFeatureFlags } from "@/lib/feature-flags";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseRolloutType(value: string) {
  return Object.values(FeatureFlagRolloutType).includes(value as FeatureFlagRolloutType)
    ? (value as FeatureFlagRolloutType)
    : FeatureFlagRolloutType.GLOBAL;
}

function revalidateAdminFlagPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/feature-flags");
  revalidatePath("/home");
  revalidatePath("/settings");
  revalidatePath("/buddy");
  revalidatePath("/single-of-the-week");
}

export async function updateFeatureFlagAdminAction(formData: FormData) {
  await requireAdmin();
  await ensureDefaultFeatureFlags();

  const key = textValue(formData, "key");
  if (!key) {
    throw new Error("Feature flag key is required.");
  }

  const enabled = formData.get("enabled") === "on";
  const rolloutType = parseRolloutType(textValue(formData, "rolloutType"));

  await prisma.featureFlag.update({
    where: { key },
    data: { enabled, rolloutType },
  });

  revalidateAdminFlagPaths();
  redirect("/admin/feature-flags?saved=feature-flag");
}

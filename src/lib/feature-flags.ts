import { FeatureFlagRolloutType, UserRole, type FeatureFlag } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const FEATURE_FLAG_KEYS = {
  buddy: "buddy_enabled",
  singleOfWeek: "single_of_week_enabled",
  r2MediaPipeline: "r2_media_pipeline_enabled",
  emailVerification: "email_verification_enabled",
} as const;

export type KnownFeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

const DEFAULT_FEATURE_FLAGS = [
  {
    key: FEATURE_FLAG_KEYS.buddy,
    enabled: true,
    description: "Controls Buddy applications, Buddy requests, and Buddy conversations.",
    rolloutType: FeatureFlagRolloutType.GLOBAL,
    rolloutValue: null,
  },
  {
    key: FEATURE_FLAG_KEYS.singleOfWeek,
    enabled: true,
    description: "Controls Single of the Week applications, hero card, and featured request flow.",
    rolloutType: FeatureFlagRolloutType.GLOBAL,
    rolloutValue: null,
  },
  {
    key: FEATURE_FLAG_KEYS.r2MediaPipeline,
    enabled: false,
    description: "Controls the R2-backed media upload pipeline for profile images and Single of the Week photos.",
    rolloutType: FeatureFlagRolloutType.GLOBAL,
    rolloutValue: null,
  },
  {
    key: FEATURE_FLAG_KEYS.emailVerification,
    enabled: true,
    description: "Controls provider-backed email verification sending, verification links, and resend flow.",
    rolloutType: FeatureFlagRolloutType.GLOBAL,
    rolloutValue: null,
  },
] as const;

type FeatureFlagUser = {
  id: string;
  role?: UserRole;
  email?: string | null;
} | null | undefined;

function parseUserList(value: FeatureFlag["rolloutValue"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)).filter(Boolean) : [];
    } catch {
      return value.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  }
  if (typeof value === "object" && value && "users" in value && Array.isArray((value as { users?: unknown[] }).users)) {
    return ((value as { users?: unknown[] }).users ?? []).map((entry) => String(entry)).filter(Boolean);
  }
  return [];
}

function parsePercentage(value: FeatureFlag["rolloutValue"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, value));
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
  }
  if (typeof value === "object" && value && "percentage" in value) {
    const parsed = Number((value as { percentage?: unknown }).percentage);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
  }
  return null;
}

function stableBucket(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash % 100;
}

export async function ensureDefaultFeatureFlags() {
  await prisma.$transaction(
    DEFAULT_FEATURE_FLAGS.map((flag) =>
      prisma.featureFlag.upsert({
        where: { key: flag.key },
        update: {
          description: flag.description,
          rolloutType: flag.rolloutType,
          rolloutValue: flag.rolloutValue ?? undefined,
        },
        create: {
          key: flag.key,
          enabled: flag.enabled,
          description: flag.description,
          rolloutType: flag.rolloutType,
          rolloutValue: flag.rolloutValue ?? undefined,
        },
      }),
    ),
  );
}

export async function getFeatureFlags() {
  await ensureDefaultFeatureFlags();
  return prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export async function getFeatureFlagByKey(key: string) {
  return prisma.featureFlag.findUnique({ where: { key } });
}

export function evaluateFeatureFlag(flag: Pick<FeatureFlag, "enabled" | "rolloutType" | "rolloutValue"> | null, user?: FeatureFlagUser) {
  if (!flag?.enabled) return false;

  switch (flag.rolloutType) {
    case FeatureFlagRolloutType.GLOBAL:
      return true;
    case FeatureFlagRolloutType.ADMIN_ONLY:
      return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
    case FeatureFlagRolloutType.USER_LIST: {
      const allowList = parseUserList(flag.rolloutValue);
      return Boolean(user && (allowList.includes(user.id) || (user.email ? allowList.includes(user.email) : false)));
    }
    case FeatureFlagRolloutType.PERCENTAGE: {
      if (!user) return false;
      const percentage = parsePercentage(flag.rolloutValue);
      if (percentage === null) return false;
      return stableBucket(user.id) < percentage;
    }
    default:
      return false;
  }
}

export async function isFeatureEnabled(key: string, user?: FeatureFlagUser) {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) return false;
  return evaluateFeatureFlag(flag, user);
}

export async function getFeatureAvailability(keys: string[], user?: FeatureFlagUser) {
  const flags = await prisma.featureFlag.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(flags.map((flag) => [flag.key, flag]));
  return Object.fromEntries(keys.map((key) => [key, evaluateFeatureFlag(byKey.get(key) ?? null, user)])) as Record<string, boolean>;
}

export async function requireFeatureEnabled(key: string, user?: FeatureFlagUser) {
  const enabled = await isFeatureEnabled(key, user);
  if (!enabled) {
    throw new Error("This feature is currently unavailable.");
  }
  return true;
}

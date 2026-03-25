import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES = 5;
export const EMAIL_VERIFICATION_DAILY_CAP = 6;

export type EmailDeliveryMode = "console" | "resend";
export type EmailVerificationConsumeStatus = "verified" | "invalid" | "expired" | "used" | "email_mismatch";

export type EmailVerificationRecordLike = {
  tokenHash: string;
  email: string;
  expiresAt: Date;
  usedAt?: Date | null;
};

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createEmailVerificationTokenPayload(userId: string, email: string, now = new Date()) {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    userId,
    email,
    rawToken,
    tokenHash: hashEmailVerificationToken(rawToken),
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000),
  };
}

export function buildEmailVerificationUrl(
  token: string,
  baseUrl = process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000",
  nextPath?: string | null,
) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = new URL(`${normalizedBaseUrl}/verify-email`);
  url.searchParams.set("token", token);
  if (nextPath) {
    url.searchParams.set("next", nextPath);
  }
  return url.toString();
}

export function getEmailDeliveryMode(): EmailDeliveryMode {
  return process.env.EMAIL_DELIVERY_MODE === "resend" ? "resend" : "console";
}

export function getEmailVerificationResendState(input: {
  lastIssuedAt: Date | null;
  recentCount: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.lastIssuedAt) {
    const retryAt = new Date(input.lastIssuedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES * 60 * 1000);
    if (retryAt > now) {
      return {
        blocked: true,
        reason: `Please wait a few minutes before requesting another verification email.`,
        retryAt,
      };
    }
  }

  if (input.recentCount >= EMAIL_VERIFICATION_DAILY_CAP) {
    return {
      blocked: true,
      reason: "You have reached today's verification email limit. Try again later.",
      retryAt: null,
    };
  }

  return {
    blocked: false,
    reason: null,
    retryAt: null,
  };
}

export function evaluateEmailVerificationTokenRecord(
  record: EmailVerificationRecordLike | null,
  currentUserEmail: string | null,
  now = new Date(),
): EmailVerificationConsumeStatus {
  if (!record) {
    return "invalid";
  }
  if (record.usedAt) {
    return "used";
  }
  if (record.expiresAt <= now) {
    return "expired";
  }
  if (!currentUserEmail || normalizeEmailAddress(currentUserEmail) !== normalizeEmailAddress(record.email)) {
    return "email_mismatch";
  }
  return "verified";
}

export async function sendVerificationEmail(input: {
  toEmail: string;
  verificationUrl: string;
  expiresAt: Date;
}) {
  const deliveryMode = getEmailDeliveryMode();
  const subject = "Verify your Evyta email";
  const expiryNote = `This link expires in ${EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hours.`;
  const text = [
    "Verify your Evyta email.",
    "",
    `Open this secure link to confirm your email address: ${input.verificationUrl}`,
    expiryNote,
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1714;">
      <p><strong>Verify your Evyta email</strong></p>
      <p>Open the secure link below to confirm your email address.</p>
      <p><a href="${input.verificationUrl}">Verify my email</a></p>
      <p style="font-size: 14px; color: #6b5c52;">${expiryNote}</p>
      <p style="font-size: 14px; color: #6b5c52;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (deliveryMode === "console") {
    console.info(`[email-verification] ${input.toEmail} ${input.verificationUrl}`);
    return { deliveryMode, previewUrl: input.verificationUrl };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Resend email delivery is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.toEmail],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Verification email could not be sent. ${body}`.trim());
  }

  return { deliveryMode, previewUrl: null };
}

export async function issueEmailVerificationForUser(userId: string, options?: { skipRateLimit?: boolean; nextPath?: string | null }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.emailVerified) {
    return {
      alreadyVerified: true,
      deliveryMode: getEmailDeliveryMode(),
      verificationUrl: null,
      expiresAt: null,
    };
  }

  const [latestToken, recentCount] = await Promise.all([
    prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        email: user.email,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.emailVerificationToken.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resendState = getEmailVerificationResendState({
    lastIssuedAt: latestToken?.createdAt ?? null,
    recentCount,
  });

  if (!options?.skipRateLimit && resendState.blocked) {
    throw new Error(resendState.reason ?? "Please wait before requesting another verification email.");
  }

  const tokenPayload = createEmailVerificationTokenPayload(user.id, user.email);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: tokenPayload.email,
        tokenHash: tokenPayload.tokenHash,
        expiresAt: tokenPayload.expiresAt,
      },
    });
  });

  const verificationUrl = buildEmailVerificationUrl(tokenPayload.rawToken, undefined, options?.nextPath);
  const delivery = await sendVerificationEmail({
    toEmail: user.email,
    verificationUrl,
    expiresAt: tokenPayload.expiresAt,
  });

  return {
    alreadyVerified: false,
    deliveryMode: delivery.deliveryMode,
    verificationUrl: delivery.previewUrl,
    expiresAt: tokenPayload.expiresAt,
  };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashEmailVerificationToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      email: true,
      tokenHash: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  const status = evaluateEmailVerificationTokenRecord(record, record?.user.email ?? null);
  if (status !== "verified" || !record) {
    return { status };
  }

  const verifiedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerified: verifiedAt },
    });

    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: verifiedAt },
    });

    await tx.emailVerificationToken.updateMany({
      where: {
        userId: record.userId,
        email: record.email,
        usedAt: null,
        id: { not: record.id },
      },
      data: { usedAt: verifiedAt },
    });
  });

  return {
    status,
    verifiedAt,
  };
}

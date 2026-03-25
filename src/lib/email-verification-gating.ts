export const EMAIL_VERIFICATION_ONBOARDING_PATH = "/onboarding?step=3";

export function getEmailVerificationBlockedReason(actionLabel: string) {
  return `Verify your email before you can ${actionLabel}.`;
}

export function isEmailVerificationCooldownError(message: string) {
  return message.includes("Please wait a few minutes before requesting another verification email.");
}

export function isEmailVerificationDailyCapError(message: string) {
  return message.includes("You have reached today's verification email limit.");
}

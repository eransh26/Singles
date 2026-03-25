import Link from "next/link";
import { requireMemberUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { EMAIL_VERIFICATION_DAILY_CAP, EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES, getEmailVerificationResendState } from "@/lib/email-verification";
import { requestEmailVerificationAction, updateEmailAddressAction } from "../actions";

const saveMessages: Record<string, { tone: "success" | "warning" | "error"; text: string }> = {
  "email-verification-sent": { tone: "success", text: "Verification link sent. Check your inbox to continue." },
  "email-verification-send-failed": { tone: "error", text: "We could not send the verification email yet. You can try again or change the email address below." },
  "email-verification-cooldown": { tone: "warning", text: `Please wait ${EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES} minutes before sending another verification email.` },
  "email-verification-limit": { tone: "warning", text: `You have reached the current daily limit of ${EMAIL_VERIFICATION_DAILY_CAP} verification emails.` },
  "email-already-verified": { tone: "success", text: "Your email is already verified." },
  "email-changed": { tone: "success", text: "Email updated. We sent a fresh verification link to the new address." },
  "email-changed-send-failed": { tone: "warning", text: "Email updated, but sending the verification link failed. You can resend it below." },
  "email-unchanged": { tone: "warning", text: "That is already your current email address." },
  "email-invalid": { tone: "error", text: "Enter a valid email address." },
  "email-in-use": { tone: "error", text: "That email is already in use." },
  "email-verified": { tone: "success", text: "Your email is verified. You can keep going." },
  "email-verification-unavailable": { tone: "error", text: "Email verification is unavailable right now." },
};

function formatRetryLabel(value: Date | null) {
  if (!value) {
    return null;
  }

  const remainingMs = value.getTime() - Date.now();
  if (remainingMs <= 0) {
    return null;
  }

  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Resend available in about ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`;
}

function noticeClassName(tone: "success" | "warning" | "error") {
  if (tone === "success") {
    return "border-[color:rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] text-[color:var(--lux-success)]";
  }

  if (tone === "warning") {
    return "border-[rgba(196,159,108,0.24)] bg-[rgba(196,159,108,0.08)] text-[#e8d2ae]";
  }

  return "border-[rgba(158,106,118,0.22)] bg-[rgba(158,106,118,0.08)] text-[#f0c9d0]";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; step?: string; error?: string }>;
}) {
  const viewer = await requireMemberUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const emailVerificationEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.emailVerification, viewer);

  const [latestToken, recentCount, viewerPostCount] = await Promise.all([
    prisma.emailVerificationToken.findFirst({
      where: { userId: viewer.id, email: viewer.email },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true },
    }),
    prisma.emailVerificationToken.count({
      where: {
        userId: viewer.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.post.count({ where: { authorUserId: viewer.id } }),
  ]);

  const resendState = getEmailVerificationResendState({
    lastIssuedAt: latestToken?.createdAt ?? null,
    recentCount,
  });

  const savedKey = typeof resolvedSearchParams.saved === "string" ? resolvedSearchParams.saved : null;
  const savedNotice = savedKey ? saveMessages[savedKey] : null;
  const requestError = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null;
  const waitingState = !viewer.emailVerified && Boolean(latestToken || savedKey === "email-verification-sent" || savedKey === "email-changed");
  const retryLabel = formatRetryLabel(resendState.retryAt);
  const showFirstActionScreen = Boolean(viewer.emailVerified) && viewerPostCount === 0;

  if (!emailVerificationEnabled) {
    return (
      <main className="lux-shell max-w-3xl">
        <section className="lux-card">
          <p className="lux-overline">Onboarding</p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Keep the circle trusted</h1>
          <p className="mt-4 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Email verification is unavailable in this environment right now.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="lux-button-secondary" href="/home">Continue browsing</Link>
            <Link className="lux-button-primary" href="/settings">Open settings</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="lux-shell max-w-3xl" data-testid="onboarding-verification-page">
      {savedNotice ? (
        <div className={`rounded-[1.25rem] border px-4 py-3 text-sm ${noticeClassName(savedNotice.tone)}`}>
          {savedNotice.text}
        </div>
      ) : null}
      {requestError ? (
        <div className={`rounded-[1.25rem] border px-4 py-3 text-sm ${noticeClassName("error")}`}>
          {requestError}
        </div>
      ) : null}

      <section className="lux-hero">
        <div className="max-w-3xl">
          <p className="lux-overline">Onboarding / Step 3</p>
          <h1 className="lux-title mt-3">Keep the circle trusted</h1>
          <p className="lux-body mt-4">
            Confirm your email before you start posting or reaching out. You can still browse quietly while this step is waiting.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Verification</p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[color:var(--lux-text)]">
              {viewer.emailVerified ? "You are verified" : waitingState ? "Check your email" : "Verify your email"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">
              {viewer.emailVerified
                ? "Your email is confirmed, so posting and trust-based interactions are unlocked."
                : waitingState
                  ? `We sent a secure link to ${viewer.email}. Open it on this device and come right back.`
                  : "Use a secure email link so trust begins with something clear, simple, and reliable."}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-[1.2rem] border border-[rgba(228,213,192,0.08)] bg-[radial-gradient(circle_at_top_left,rgba(189,151,100,0.06),transparent_38%),rgba(255,255,255,0.026)] p-4 text-sm text-[color:var(--lux-text-secondary)]">
              <p className="font-medium text-[color:var(--lux-text)]">Current email</p>
              <p className="mt-2 break-all text-base font-semibold tracking-tight text-[color:var(--lux-text)]">{viewer.email}</p>
              <p className="mt-2 leading-6">
                {viewer.emailVerified ? "Verified and ready for posting, messaging, and onboarding continuation." : "Unverified for now. You can still look around while you finish this step."}
              </p>
            </div>

            {viewer.emailVerified ? (
              showFirstActionScreen ? (
                <div className="rounded-[1.2rem] border border-[rgba(255,255,255,0.07)] bg-[radial-gradient(circle_at_top_left,rgba(189,151,100,0.06),transparent_34%),rgba(255,255,255,0.026)] p-4 text-sm text-[color:var(--lux-text-secondary)]" data-testid="onboarding-first-action-card">
                  <p className="font-medium text-[color:var(--lux-text)]">Start simple</p>
                  <p className="mt-2 leading-6">Your first post can be small. A quiet hello is enough to feel present here.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link className="lux-button-primary" href="/home?compose=1&firstPost=1">Share something small</Link>
                    <Link className="lux-button-secondary" href="/search">Explore quietly</Link>
                    <Link className="lux-button-subtle" href="/buddy">Get a Buddy</Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Link className="lux-button-primary" href="/home">Continue to the app</Link>
                  <Link className="lux-button-secondary" href="/settings">Open settings</Link>
                </div>
              )
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <form action={requestEmailVerificationAction}>
                    <input name="sourcePath" type="hidden" value="/onboarding?step=3" />
                    <input name="nextPath" type="hidden" value="/onboarding?step=3" />
                    <button className="lux-button-primary" disabled={resendState.blocked} type="submit">
                      {waitingState ? "Resend verification link" : "Send verification link"}
                    </button>
                  </form>
                  <a className="lux-button-secondary" href={`mailto:${viewer.email}`}>Open email app</a>
                  <Link className="lux-button-subtle" href="/home">Browse first</Link>
                </div>

                {retryLabel || resendState.reason ? (
                  <p className="text-xs leading-6 text-[color:var(--lux-text-muted)]">
                    {retryLabel ?? resendState.reason}
                  </p>
                ) : null}

                <div className="rounded-[1.2rem] border border-[rgba(255,255,255,0.07)] bg-[radial-gradient(circle_at_top_left,rgba(189,151,100,0.06),transparent_34%),rgba(255,255,255,0.026)] p-4 text-sm text-[color:var(--lux-text-secondary)]">
                  <p className="font-medium text-[color:var(--lux-text)]">Use another email</p>
                  <p className="mt-2 leading-6">If this inbox is not right for you, update it here and we will send a fresh link immediately.</p>
                  <form action={updateEmailAddressAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="grid gap-2">
                      <span className="font-medium text-[color:var(--lux-text)]">Email address</span>
                      <input className="lux-input" defaultValue={viewer.email} name="email" placeholder="Email" required type="email" />
                    </label>
                    <input name="sourcePath" type="hidden" value="/onboarding?step=3" />
                    <input name="nextPath" type="hidden" value="/onboarding?step=3" />
                    <button className="lux-button-secondary" type="submit">Use another email</button>
                  </form>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="lux-card">
          <div className="border-b lux-divider pb-5">
            <p className="lux-overline">Before verification</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">What stays limited</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-6 text-[color:var(--lux-text-secondary)]">
            <div className="lux-card-soft">Browse Home, Explore, Events, and profiles while you get settled.</div>
            <div className="lux-card-soft">Posting and replying stay locked until your email is verified.</div>
            <div className="lux-card-soft">Messaging, Buddy requests, and video requests stay blocked until verification is complete.</div>
          </div>
        </aside>
      </section>
    </main>
  );
}



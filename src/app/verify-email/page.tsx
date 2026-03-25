import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { consumeEmailVerificationToken } from "@/lib/email-verification";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { requestEmailVerificationAction } from "../(app)/actions";

function statusCopy(status: string | null) {
  switch (status) {
    case "verified":
      return {
        title: "Email verified",
        description: "Your Evyta email is now verified and ready for trust-based features.",
      };
    case "expired":
      return {
        title: "Verification link expired",
        description: "This verification link has expired. Request a new email to continue.",
      };
    case "used":
      return {
        title: "Verification link already used",
        description: "This link has already been used. If you still need help, request a fresh verification email.",
      };
    case "email_mismatch":
      return {
        title: "Verification link no longer matches",
        description: "This link belongs to an older email state. Request a new verification email for your current address.",
      };
    default:
      return {
        title: "Verification link invalid",
        description: "We could not verify this link. Request a new verification email and try again.",
      };
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; status?: string; next?: string }>;
}) {
  const viewer = await getCurrentUser();
  const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.emailVerification, viewer);
  const resolvedSearchParams = await searchParams;
  const rawToken = typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams.token : "";
  const statusParam = typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : null;
  const nextParam = typeof resolvedSearchParams?.next === "string" ? resolvedSearchParams.next : null;

  if (!enabled) {
    return (
      <main className="lux-shell">
        <section className="lux-card max-w-2xl">
          <p className="lux-overline">Email verification</p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">Unavailable right now</h1>
          <p className="mt-4 text-sm leading-6 text-[color:var(--lux-text-secondary)]">Email verification is currently turned off for this environment.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="lux-button-secondary" href={viewer ? "/settings" : "/login"}>Go back</Link>
          </div>
        </section>
      </main>
    );
  }

  if (rawToken && !statusParam) {
    const result = await consumeEmailVerificationToken(rawToken);
    const nextQuery = nextParam ? `&next=${encodeURIComponent(nextParam)}` : "";
    redirect(`/verify-email?status=${result.status}${nextQuery}`);
  }

  const status = statusParam ?? "invalid";
  const copy = statusCopy(status);

  if (status === "verified" && viewer && nextParam) {
    redirect(nextParam.includes("saved=") ? nextParam : (nextParam.includes("?") ? `${nextParam}&saved=email-verified` : `${nextParam}?saved=email-verified`));
  }

  return (
    <main className="lux-shell">
      <section className="lux-card max-w-2xl">
        <p className="lux-overline">Email verification</p>
        <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-[color:var(--lux-text)]">{copy.title}</h1>
        <p className="mt-4 text-sm leading-6 text-[color:var(--lux-text-secondary)]">{copy.description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="lux-button-secondary" href={viewer ? "/settings" : "/login"}>{viewer ? "Open settings" : "Sign in"}</Link>
          {viewer && status !== "verified" ? (
            <form action={requestEmailVerificationAction}>
              <input name="sourcePath" type="hidden" value={nextParam ?? "/verify-email"} />
              <input name="nextPath" type="hidden" value={nextParam ?? "/verify-email"} />
              <button className="lux-button-primary" type="submit">Send a new verification email</button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}

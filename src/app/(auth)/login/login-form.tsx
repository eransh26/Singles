"use client";

import { useEffect, useState, useTransition } from "react";

const GENERIC_SIGN_IN_ERROR = "We couldn’t sign you in. If the problem continues, please contact support.";

export function LoginForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  function submitCredentials(formData: FormData) {
    const email = String(formData.get("email") ?? "").toLowerCase();
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      setErrorMessage(null);

      const response = await fetch("/api/credentials-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setErrorMessage(GENERIC_SIGN_IN_ERROR);
        return;
      }

      const payload = (await response.json()) as { redirectTo?: string };
      window.location.assign(payload.redirectTo ?? "/home");
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitCredentials(new FormData(event.currentTarget));
      }}
    >
      {errorMessage ? (
        <div className="rounded-[var(--ev-r-input)] border border-[color:rgba(192,138,160,0.35)] bg-[color:var(--ev-rose-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--ev-rose-text)]">
          {errorMessage}
        </div>
      ) : null}
      <input className="ev-input" name="email" placeholder="Email" required type="email" />
      <input className="ev-input" name="password" placeholder="Password" required type="password" />
      <button
        className="ev-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!isHydrated || isPending}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (!form) {
            return;
          }

          event.preventDefault();
          submitCredentials(new FormData(form));
        }}
        type="button"
      >
        {!isHydrated ? "Loading..." : isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

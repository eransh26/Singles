"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const GENERIC_SIGN_IN_ERROR = "We couldn’t sign you in. If the problem continues, please contact support.";

export function LoginForm() {
  const router = useRouter();
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
      router.push(payload.redirectTo ?? "/home");
      router.refresh();
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
        <div className="rounded-[1.1rem] border border-[color:rgba(138,91,82,0.24)] bg-[color:rgba(138,91,82,0.08)] px-4 py-3 text-sm leading-6 text-[color:var(--lux-danger)]">
          {errorMessage}
        </div>
      ) : null}
      <input className="lux-input" name="email" placeholder="Email" required type="email" />
      <input className="lux-input" name="password" placeholder="Password" required type="password" />
      <button
        className="lux-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
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

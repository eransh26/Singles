import { registerAction, signInWithGoogleAction } from "../actions";
import { AuthShell } from "../auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell
      alternateHref="/login"
      alternateLabel="Sign in"
      alternatePrompt="Already inside?"
      description="Join the circle quietly. Create your access to a private, trust-first community."
      eyebrow="Request access"
      title="Request your place."
    >
      <div className="space-y-4">
        <form action={registerAction} className="flex flex-col gap-3">
          <input className="ev-input" name="displayName" placeholder="Your name" required type="text" />
          <input className="ev-input" name="email" placeholder="Email" required type="email" />
          <input className="ev-input" name="password" placeholder="Password (8+ chars)" required type="password" />
          <button className="ev-btn-primary w-full" type="submit">
            Request access
          </button>
        </form>
        <form action={signInWithGoogleAction}>
          <button className="ev-btn-secondary w-full" type="submit">
            Continue with Google
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

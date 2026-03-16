import { registerAction, signInWithGoogleAction } from "../actions";
import { AuthShell } from "../auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell
      alternateHref="/login"
      alternateLabel="Sign in"
      alternatePrompt="Already have an account?"
      description="Create a member account for a more private, curated adult community experience."
      eyebrow="Member registration"
      title="Request your place."
    >
      <div className="space-y-4">
        <form action={registerAction} className="flex flex-col gap-3">
          <input className="lux-input" name="displayName" placeholder="Display name" required type="text" />
          <input className="lux-input" name="email" placeholder="Email" required type="email" />
          <input className="lux-input" name="password" placeholder="Password (8+ chars)" required type="password" />
          <button className="lux-button-primary w-full justify-center" type="submit">
            Create account
          </button>
        </form>
        <form action={signInWithGoogleAction}>
          <button className="lux-button-secondary w-full justify-center" type="submit">
            Continue with Google
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

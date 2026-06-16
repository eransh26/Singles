import { signInWithGoogleAction } from "../actions";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      alternateHref="/register"
      alternateLabel="Request access"
      alternatePrompt="New to the circle?"
      description="Welcome back. Enter the private Evyta circle with the method attached to your account."
      eyebrow="Sign in"
      title="Enter quietly."
    >
      <div className="space-y-4">
        <LoginForm />
        <form action={signInWithGoogleAction}>
          <button className="ev-btn-secondary w-full" type="submit">
            Continue with Google
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

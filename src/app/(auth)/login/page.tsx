import { signInWithGoogleAction } from "../actions";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      alternateHref="/register"
      alternateLabel="Create one"
      alternatePrompt="No account yet?"
      description="Enter the private Evyta member circle with the sign-in method attached to your account."
      eyebrow="Member sign in"
      title="Enter quietly."
    >
      <div className="space-y-4">
        <LoginForm />
        <form action={signInWithGoogleAction}>
          <button className="lux-button-secondary w-full justify-center" type="submit">
            Continue with Google
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

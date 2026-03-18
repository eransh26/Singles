import Link from "next/link";
import { createBuddyRequestAction } from "../actions";
import { requireActiveUser } from "@/lib/auth/guards";
import { BUDDY_DOMAIN_OPTIONS, BUDDY_SUPPORT_MODE_OPTIONS } from "@/lib/buddy";

export default async function NewBuddyRequestPage() {
  await requireActiveUser();

  return (
    <main className="lux-shell max-w-4xl">
      <section className="lux-hero">
        <div className="max-w-3xl">
          <p className="lux-overline">Need help? Get a Buddy</p>
          <h1 className="lux-title mt-3">Ask for support without having to browse for the right person.</h1>
          <p className="lux-body mt-4">
            Choose the support area that fits best. Your request will be routed privately to available Buddies in that domain.
          </p>
        </div>
      </section>

      <section className="lux-card">
        <div className="border-b lux-divider pb-5">
          <p className="lux-overline">Buddy request</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Peer support, not therapy or legal advice</h2>
        </div>
        <form action={createBuddyRequestAction} className="mt-5 grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
          <label className="grid gap-2">
            <span className="font-medium text-[color:var(--lux-text)]">Support domain</span>
            <select className="lux-select" defaultValue={BUDDY_DOMAIN_OPTIONS[0]?.value} name="domain">
              {BUDDY_DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-[color:var(--lux-text)]">Short message (optional)</span>
            <textarea className="lux-textarea min-h-[120px]" maxLength={500} name="message" placeholder="Share a little context so the Buddy knows what kind of support would help." />
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-[color:var(--lux-text)]">Preferred support mode</span>
            <select className="lux-select" defaultValue={BUDDY_SUPPORT_MODE_OPTIONS[0]?.value} name="preferredMode">
              {BUDDY_SUPPORT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="rounded-[1rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)] px-4 py-4 text-sm leading-6 text-[color:var(--lux-text-secondary)]">
            Video remains a separate consent step later. Choosing <strong className="text-[color:var(--lux-text)]">VIDEO_OK</strong> or <strong className="text-[color:var(--lux-text)]">EITHER</strong> only signals preference.
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Link className="lux-button-secondary" href="/buddy">Cancel</Link>
            <button className="lux-button-primary" type="submit">Submit Buddy request</button>
          </div>
        </form>
      </section>
    </main>
  );
}

import { signOutAction } from "../(auth)/actions";
import { requireMemberUser } from "@/lib/auth/guards";
import { MemberNav } from "./member-nav";

const navigation = [
  { href: "/home", label: "Home" },
  { href: "/groups", label: "Groups" },
  { href: "/chats", label: "Chats" },
  { href: "/notifications", label: "Notifications" },
  { href: "/me", label: "Profile" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireMemberUser();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-[color:rgba(179,154,136,0.16)] bg-[color:rgba(247,243,238,0.7)] backdrop-blur-2xl dark:bg-[color:rgba(20,17,15,0.74)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between lg:flex-1 lg:items-center lg:gap-8">
            <div className="space-y-1">
              <p className="lux-overline">Evyta</p>
              <div>
                <p className="text-xl font-semibold tracking-[0.02em] text-[color:var(--lux-text)]">Private member circle</p>
                <p className="text-sm text-[color:var(--lux-text-secondary)]">Signed in as {currentUser.email}</p>
              </div>
            </div>
            <MemberNav items={navigation} />
          </div>
          <form action={signOutAction}>
            <button className="lux-button-secondary min-w-[120px]" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

import Image from "next/image";
import { signOutAction } from "../(auth)/actions";
import { requireMemberUser } from "@/lib/auth/guards";
import { MemberNav } from "./member-nav";
import { MemberHeaderFrame } from "./member-header-frame";

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
      <MemberHeaderFrame>
        <header className="sticky top-0 z-30 bg-[linear-gradient(180deg,rgba(17,14,12,0.94),rgba(22,18,16,0.9))] text-[#fff4ea] shadow-[0_12px_34px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="mx-auto max-w-6xl px-4 pb-3 pt-3 md:px-6 md:pb-4 md:pt-4">
            <div className="member-header-panel relative overflow-hidden rounded-[1.9rem] border border-[rgba(201,167,110,0.16)] bg-[linear-gradient(145deg,rgba(35,29,25,0.94),rgba(24,20,17,0.96))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:px-5 md:py-4">
              <div className="member-header-watermark pointer-events-none absolute inset-y-0 right-0 hidden w-48 items-center justify-center md:flex">
                <div className="relative h-32 w-32 opacity-[0.06]">
                  <Image alt="" className="object-contain" fill sizes="128px" src="/brand/evyta-icon-256.png" />
                </div>
              </div>

              <div className="relative flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="member-header-logo max-w-[165px] sm:max-w-[190px] md:max-w-[210px]">
                      <Image alt="Evyta" className="h-auto w-full object-contain" height={84} priority src="/brand/evyta-logo.png" width={280} />
                    </div>
                    <div className="member-header-meta mt-2 flex flex-wrap items-center gap-2.5 text-xs uppercase tracking-[0.16em] text-[#bdaea1]">
                      <span>Private member circle</span>
                      <span className="hidden h-1 w-1 rounded-full bg-[rgba(201,167,110,0.6)] sm:block" />
                      <span className="normal-case tracking-normal text-[#8f7f72]">Signed in as {currentUser.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <div className="member-header-seal hidden items-center gap-2 rounded-full border border-[rgba(201,167,110,0.14)] bg-[rgba(255,248,242,0.04)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#cdbdaf] sm:flex">
                      <Image alt="Evyta seal" height={16} src="/brand/evyta-icon-32.png" width={16} />
                      <span>Members only</span>
                    </div>
                    <form action={signOutAction}>
                      <button className="member-header-signout lux-button-secondary min-w-[110px] border-[rgba(201,167,110,0.18)] bg-[rgba(255,248,242,0.04)] px-3 py-2 text-[#fff4ea]" type="submit">
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>

                <div className="member-header-nav rounded-[1.2rem] border border-[rgba(201,167,110,0.1)] bg-[rgba(255,248,242,0.03)] px-1 py-1.5 md:px-2">
                  <MemberNav items={navigation} />
                </div>
              </div>
            </div>

            <div className="member-header-divider mt-3 h-px bg-[linear-gradient(90deg,transparent,rgba(201,167,110,0.28),transparent)]" />
          </div>
        </header>
      </MemberHeaderFrame>
      {children}
    </div>
  );
}

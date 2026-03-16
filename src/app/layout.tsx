import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/guards";
import { ThemePreference } from "@prisma/client";

export const metadata: Metadata = {
  title: "Evyta",
  description: "Private, consent-first premium community platform",
  icons: {
    icon: [
      { url: "/brand/evyta-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/evyta-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/evyta-icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/brand/evyta-icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/brand/evyta-icon-256.png", sizes: "256x256", type: "image/png" },
      { url: "/brand/evyta-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [
      { url: "/brand/evyta-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/evyta-icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/brand/evyta-icon-128.png", sizes: "128x128", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentUser();

  let theme: ThemePreference = ThemePreference.LIGHT;
  if (currentUser?.email) {
    const settings = await prisma.userSettings.findFirst({
      where: { user: { email: currentUser.email } },
      select: { themePreference: true },
    });

    if (settings?.themePreference) {
      theme = settings.themePreference;
    }
  }

  return (
    <html lang="en" className={theme === ThemePreference.DARK ? "dark" : ""}>
      <body>{children}</body>
    </html>
  );
}

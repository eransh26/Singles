import "@livekit/components-styles";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evyta",
  description: "Private, consent-first premium community platform",
  icons: {
    icon: [{ url: "/brand/favicon.svg?v=2", type: "image/svg+xml" }],
    shortcut: [{ url: "/brand/favicon.svg?v=2", type: "image/svg+xml" }],
    apple: [{ url: "/brand/favicon.svg?v=2", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

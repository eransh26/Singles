import "@livekit/components-styles";
import type { Metadata } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

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
    <html className={`${hanken.variable} ${newsreader.variable}`} lang="en">
      <body>{children}</body>
    </html>
  );
}

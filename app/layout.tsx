import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMC · Eventphoto Mission Control",
  description: "Operativ og synkronisert bemanningsplan for fototeam under Oslo Proptech Summit 2026.",
  robots: { index: false, follow: false, noarchive: true },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" data-theme="light">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMC · Eventphoto Mission Control",
  description: "Operativ og synkronisert bemanningsplan for fototeam på konferanser og eventer.",
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
    <html lang="no" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Source+Sans+3:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem('emc-theme-v2');var theme=saved==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}

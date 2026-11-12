import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { FruitMaskProvider } from "../components/fruit-mask";
import { ThemeScript } from "../components/theme-script";
import { AppNav } from "./nav";
import { DatabaseProvider, PersistBanner, WorkspaceReady } from "./workspace-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expo Tracker",
  description: "Tracker for artist-alley applications to cons that come back every year.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <DatabaseProvider>
          <FruitMaskProvider>
            <AppNav />
            <PersistBanner />
            <WorkspaceReady>{children}</WorkspaceReady>
          </FruitMaskProvider>
        </DatabaseProvider>
      </body>
    </html>
  );
}

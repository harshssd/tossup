import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "TossUp - Complete Cricket Management Platform",
  description: "Comprehensive cricket management platform for clubs, tournaments, and auctions. Manage players, organize leagues, run sealed-bid auctions, and track performance analytics.",
  keywords: ["cricket", "club management", "tournament", "league", "auction", "player management", "cricket analytics", "sports management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

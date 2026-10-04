import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { engineer } from "@/config/content";

/**
 * Geist for the interface, Geist Mono for the technical register.
 *
 * context.txt TYPOGRAPHY: "Use a modern grotesk or geometric sans-serif.
 * Headlines should feel architectural. Use small uppercase technical labels for
 * system metadata." A grotesk with a mono companion is exactly that pairing, and
 * both ship with Next rather than being fetched at runtime.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Description drawn from `config/content` rather than written here, so the
 * metadata and the page can never drift apart.
 */
export const metadata: Metadata = {
  title: `${engineer.name} — ${engineer.role}`,
  description: engineer.summary,
  keywords: [
    "Ajit Kumar",
    "software engineer",
    "backend engineer",
    "Node.js",
    "microservices",
    "Shopify integration",
    "ERP integration",
    "AWS SQS",
    "GraphQL",
    "event-driven systems",
  ],
  authors: [{ name: engineer.name }],
  openGraph: {
    title: `${engineer.name} — ${engineer.role}`,
    description: engineer.summary,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04060c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
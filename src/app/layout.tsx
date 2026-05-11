import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARIA — AI Conversational Avatar",
  description:
    "Interactive AI avatar with real-time voice conversation, VRM 3D character, lip sync, facial expressions, and web search capabilities. Speak naturally and ARIA responds with emotion.",
  keywords: [
    "AI Avatar",
    "Conversational AI",
    "VRM",
    "Three.js",
    "Voice Assistant",
    "Text-to-Speech",
    "Speech Recognition",
    "Lip Sync",
    "Real-time AI",
  ],
  authors: [{ name: "ARIA AI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "ARIA — AI Conversational Avatar",
    description:
      "Speak to ARIA, an AI avatar that responds with voice, expressions, and real-time intelligence.",
    url: "https://chat.z.ai",
    siteName: "ARIA AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARIA — AI Conversational Avatar",
    description:
      "Interactive AI avatar with voice conversation and emotional expressions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

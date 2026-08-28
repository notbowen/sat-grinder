import type { Metadata } from "next";
import { Newsreader, Noto_Serif, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { GoogleAnalytics } from '@next/third-parties/google'
import "katex/dist/katex.min.css";
import "./globals.css";

// UI face: Space Grotesk Regular (400), with 500/600 for emphasis.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-grotesk", display: "swap" });
// Display face: Newsreader (variable, optical size + italics) for headlines.
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader", display: "swap" });
// Question face: Noto Serif, matching the typography of College Board's Bluebook app.
const notoSerif = Noto_Serif({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-noto-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SAT Grinder", template: "%s · SAT Grinder" },
  description: "Medium and hard digital SAT practice: Bluebook-style questions, a review queue that brings back every miss, and stats that show what you can do reliably.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${grotesk.variable} ${newsreader.variable} ${notoSerif.variable}`}><body><AuthProvider>{children}</AuthProvider></body><GoogleAnalytics gaId="G-ZZ8VYFKXR3" /></html>;
}

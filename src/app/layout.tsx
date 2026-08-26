import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SAT Grinder", template: "%s · SAT Grinder" },
  description: "Master medium and hard SAT questions in English, Math, or mixed practice sets.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}

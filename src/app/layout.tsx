import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SAT Grinder", template: "%s · SAT Grinder" },
  description: "Master medium and hard SAT questions, one topic at a time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

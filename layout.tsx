import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SAT Practice Lab",
  description: "SAT test practice platform for students and instructors.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz"><body>{children}</body></html>;
}

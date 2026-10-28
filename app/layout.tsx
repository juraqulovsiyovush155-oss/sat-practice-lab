import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Siyovush SAT",
  description: "SAT mock imtihonlariga tayyorgarlik platformasi.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz"><body>{children}</body></html>;
}

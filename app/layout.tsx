import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Siyovush SAT · GRE",
  description: "SAT va GRE imtihonlariga tayyorgarlik dasturlari va mashq platformasi.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz"><body>{children}</body></html>;
}

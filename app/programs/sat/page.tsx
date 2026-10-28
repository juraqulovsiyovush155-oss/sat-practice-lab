import type { Metadata } from "next";
import { ProgramPage } from "@/components/marketing";

export const metadata: Metadata = {
  title: "SAT tayyorgarlik dasturi | Siyovush",
  description: "Digital SAT Reading & Writing va Math bo‘limlariga maqsadli tayyorgarlik.",
};

export default function SATProgramPage() {
  return <ProgramPage exam="sat" />;
}

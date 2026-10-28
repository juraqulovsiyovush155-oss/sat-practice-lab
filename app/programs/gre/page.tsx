import type { Metadata } from "next";
import { ProgramPage } from "@/components/marketing";

export const metadata: Metadata = {
  title: "GRE tayyorgarlik dasturi | Siyovush",
  description: "GRE Verbal Reasoning, Quantitative Reasoning va Analytical Writing tayyorgarligi.",
};

export default function GREProgramPage() {
  return <ProgramPage exam="gre" />;
}

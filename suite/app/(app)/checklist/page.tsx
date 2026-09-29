import type { Metadata } from "next";
import { ChecklistPage } from "@/components/checklist/ChecklistPage";

export const metadata: Metadata = {
  title: "Checklist",
  description: "What to have done before the day, each with a date to be done by.",
};

export default function Checklist() {
  return <ChecklistPage />;
}

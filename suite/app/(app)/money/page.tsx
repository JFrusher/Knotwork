import type { Metadata } from "next";
import { MoneyPage } from "@/components/money/MoneyPage";

export const metadata: Metadata = {
  title: "Money",
  description: "What the suppliers cost, what has been paid, and what is still to pay.",
};

export default function Money() {
  return <MoneyPage />;
}

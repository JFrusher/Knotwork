import type { Metadata } from "next";
import { BarClient } from "./BarClient";

export const metadata: Metadata = {
  title: "Bar",
  description: "How much drink to buy, in bottles and cases, and roughly what it costs.",
};

export default function BarPage() {
  return <BarClient />;
}

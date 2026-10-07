import type { Metadata } from "next";
import { DelegationApp } from "./DelegationClient";

export const metadata: Metadata = {
  title: "Delegation",
  description: "The jobs of the day, and the hands doing them.",
};

export default function DelegationPage() {
  return <DelegationApp />;
}

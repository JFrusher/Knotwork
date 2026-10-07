import type { Metadata } from "next";
import { DelegationApp } from "./DelegationClient";

export const metadata: Metadata = {
  title: "Delegation",
  description: "The jobs of the day, and the hands doing them.",
};

export default function DelegationPage() {
  return (
    <>
      {/* The tool's name is on screen as the current tab; this one is for screen readers. */}
      <h1 className="sr-only">Delegation</h1>
      <DelegationApp />
    </>
  );
}

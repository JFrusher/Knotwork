import type { Metadata } from "next";
import { CeremonyClient } from "./CeremonyClient";

export const metadata: Metadata = {
  title: "Ceremony",
  description: "The processional: who walks, in what order, how, and to what music.",
};

export default function CeremonyPage() {
  return <CeremonyClient />;
}

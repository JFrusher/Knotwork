import type { Metadata } from "next";
import { SeatingApp } from "./SeatingClient";

export const metadata: Metadata = {
  title: "Seating",
  description: "Build the room to scale, then put people in it.",
};

export default function SeatingPage() {
  return <SeatingApp />;
}

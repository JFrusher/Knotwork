import type { Metadata } from "next";
import { BoxesClient } from "./BoxesClient";

export const metadata: Metadata = {
  title: "Boxes",
  description: "What is packed in which box, and where each has to be, by when.",
};

export default function BoxesPage() {
  return <BoxesClient />;
}

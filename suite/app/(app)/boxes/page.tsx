import type { Metadata } from "next";
import { BoxesClient } from "./BoxesClient";

export const metadata: Metadata = {
  title: "Boxes",
  description: "What is packed in which box, and where each has to be, by when.",
};

export default function BoxesPage() {
  return (
    <>
      {/* The tool's name is on screen as the current tab; this one is for screen readers. */}
      <h1 className="sr-only">Boxes</h1>
      <BoxesClient />
    </>
  );
}

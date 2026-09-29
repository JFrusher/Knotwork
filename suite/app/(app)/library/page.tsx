import type { Metadata } from "next";
import { LibraryPage } from "@/components/library/LibraryPage";

export const metadata: Metadata = {
  title: "Library",
  description: "Card designs, running orders, rooms and checklists kept to use again, for any wedding you plan.",
};

export default function Library() {
  return <LibraryPage />;
}

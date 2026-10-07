import type { Metadata } from "next";
import { GroupShotsClient } from "./GroupShotsClient";

export const metadata: Metadata = {
  title: "Group shots",
  description: "The family and group photo list, built from the guest list and the room.",
};

export default function GroupShotsPage() {
  return (
    <>
      {/* The tool's name is on screen as the current tab; this one is for screen readers. */}
      <h1 className="sr-only">Group shots</h1>
      <GroupShotsClient />
    </>
  );
}

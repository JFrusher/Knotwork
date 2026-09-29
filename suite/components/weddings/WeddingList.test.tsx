// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WeddingList } from "./WeddingList";
import type { WeddingListing } from "@/lib/accounts/handlers";

const wedding = (over: Partial<WeddingListing>): WeddingListing => ({
  weddingId: "w",
  role: "planner",
  names: "",
  date: "",
  savedAt: "2026-09-28T09:00:00Z",
  state: { left: 0, blocking: 0, next: null, owed: 0 },
  ...over,
});

describe("a planner's list of clients", () => {
  it("puts the soonest wedding first and one with no date last, each with how it stands", () => {
    render(
      <WeddingList
        open="b"
        weddings={[
          wedding({ weddingId: "a", names: "Later & Co", date: "2029-05-01" }),
          wedding({ weddingId: "u", names: "Undated & Co" }),
          wedding({
            weddingId: "b",
            names: "Robin & Kit",
            date: "2028-06-01",
            state: { left: 3, blocking: 1, next: "Two group shots point at someone who no longer exists.", owed: 1700 },
          }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => within(row).getAllByText(/&/)[0]!.textContent)).toEqual(["Robin & Kit", "Later & Co", "Undated & Co"]);
    expect(rows[0]!.textContent).toContain("Next: Two group shots point at someone who no longer exists. (and 2 more)");
    expect(rows[0]!.textContent).toContain("1,700 still to pay");
    expect(rows[0]!.textContent).toContain("Open here");
    expect(rows[1]!.textContent).toContain("Nothing left that spans the tools.");
    expect(within(rows[1]!).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/open/a");
  });
});

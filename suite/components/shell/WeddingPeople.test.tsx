// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, expect, test, vi } from "vitest";
import type { PersonRecord } from "@/lib/accounts/store";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { ConfirmProvider } = await import("@/components/ui/Confirm");
const { WeddingPeople } = await import("./WeddingPeople");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/*
 * The account page can't be signed into under Playwright (the e2e build has no
 * Supabase), so who sees which control is checked here, on the component, and
 * the rules behind them in `lib/accounts` and against PGlite.
 */
const PEOPLE: PersonRecord[] = [
  // In the order `wedding_people` returns them: by role, alphabetically.
  { userId: "ash", email: "ash@planners.example", role: "assistant", joinedAt: "2026-10-03" },
  { userId: "alice", email: "alice@example.com", role: "partner", joinedAt: "2026-10-01" },
  { userId: "pat", email: "pat@planners.example", role: "planner", joinedAt: "2026-10-02" },
];

function as(me: string) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(init?.method ? {} : { people: PEOPLE }),
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(
    <ConfirmProvider>
      <WeddingPeople weddingId="w1" me={me} onNotice={() => {}} />
    </ConfirmProvider>,
  );
  return { fetch, view };
}

const rows = () => screen.getAllByRole("listitem").map((li) => li.textContent);

test("the couple sees everyone, assistants last, and can remove the planner and an assistant", async () => {
  as("alice");
  await screen.findByText("ash@planners.example");
  expect(rows()).toEqual([
    "alice@example.com · One of the couple (you)Leave",
    "pat@planners.example · PlannerRemove",
    "ash@planners.example · AssistantRemove",
  ]);
  // The couple invites the other of the two, or a planner; never an assistant.
  expect(screen.queryByRole("radio", { name: /Your assistant/ })).toBeNull();
});

test("the planner can invite an assistant and remove one, but not the couple", async () => {
  const { fetch } = as("pat");
  await screen.findByText("ash@planners.example");
  expect(rows()).toEqual([
    "alice@example.com · One of the couple",
    "pat@planners.example · Planner (you)Leave",
    "ash@planners.example · AssistantRemove",
  ]);

  fireEvent.click(screen.getByRole("radio", { name: "Your assistant" }));
  fireEvent.change(screen.getByLabelText("Their email"), { target: { value: "bea@planners.example" } });
  fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/accounts/invite", expect.objectContaining({ method: "POST" })));
  const sent = fetch.mock.calls.find(([url]) => url === "/api/accounts/invite")![1]!;
  expect(JSON.parse(sent.body as string)).toEqual({ weddingId: "w1", email: "bea@planners.example", role: "assistant" });
});

test("an assistant sees who is on the wedding, and can only leave", async () => {
  as("ash");
  await screen.findByText("ash@planners.example");
  expect(rows()).toEqual([
    "alice@example.com · One of the couple",
    "pat@planners.example · Planner",
    "ash@planners.example · Assistant (you)Leave",
  ]);
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  expect(screen.queryByText("Invite someone")).toBeNull();
});

test("each view has no accessibility violations", async () => {
  for (const me of ["alice", "pat", "ash"]) {
    const { view } = as(me);
    await screen.findByText("ash@planners.example");
    const { violations } = await axe.run(view.container);
    expect(violations.map((v) => v.id)).toEqual([]);
    cleanup();
  }
});

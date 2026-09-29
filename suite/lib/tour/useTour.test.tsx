import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));

const { TourProvider, useTour } = await import("./useTour");
const { CHAPTERS } = await import("./steps");
const { ConfirmProvider } = await import("@/components/ui/Confirm");
const { TakeTheTour, HowThisWorks } = await import("@/components/shell/TourButtons");
const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { migrate } = await import("@jfrusher/trousseau");

afterEach(() => {
  cleanup();
  useTrousseauStore.setState({ doc: migrate({}) });
});

/** What the tour card would show, without the card's modal dialog. */
function Probe() {
  const { step, index, total, next } = useTour();
  return (
    <div>
      <p data-testid="at">{step ? `${step.route} ${index}/${total}` : "closed"}</p>
      <button type="button" onClick={next}>
        tour next
      </button>
    </div>
  );
}

function renderTour(entry: React.ReactNode) {
  render(
    <ConfirmProvider>
      <TourProvider>
        {entry}
        <Probe />
      </TourProvider>
    </ConfirmProvider>,
  );
}

const ALL = CHAPTERS.reduce((sum, chapter) => sum + chapter.steps.length, 0);

test("Take a tour runs every chapter, one after another", async () => {
  renderTour(<TakeTheTour />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Take a tour/ })));
  expect(screen.getByTestId("at").textContent).toBe(`/ 1/${ALL}`);

  const front = CHAPTERS[0]!.steps.length;
  for (let i = 0; i < front; i += 1) fireEvent.click(screen.getByRole("button", { name: "tour next" }));
  // Across into the next chapter, on its own page, rather than stopping.
  expect(screen.getByTestId("at").textContent).toBe(`${CHAPTERS[1]!.steps[0]!.route} ${front + 1}/${ALL}`);

  for (let i = front; i < ALL; i += 1) fireEvent.click(screen.getByRole("button", { name: "tour next" }));
  expect(screen.getByTestId("at").textContent).toBe("closed");
});

test("Take a tour leaves out the chapters of tools the wedding has removed", async () => {
  useTrousseauStore.setState({ doc: migrate({ tools: { shown: ["timeline"] } }) });
  const kept = CHAPTERS.filter((chapter) => ["shell", "guests", "timeline"].includes(chapter.id));
  const total = kept.reduce((sum, chapter) => sum + chapter.steps.length, 0);
  renderTour(<TakeTheTour />);
  // "Take the tour again" by now: the test before this one has seen it.
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Take (a|the) tour/ })));
  expect(screen.getByTestId("at").textContent).toBe(`/ 1/${total}`);
});

test("How this page works explains the page you are on, and only that", () => {
  renderTour(<HowThisWorks />);
  fireEvent.click(screen.getByRole("button", { name: "How this page works" }));
  const shell = CHAPTERS[0]!.steps.length;
  expect(screen.getByTestId("at").textContent).toBe(`/ 1/${shell}`);
  for (let i = 0; i < shell; i += 1) fireEvent.click(screen.getByRole("button", { name: "tour next" }));
  expect(screen.getByTestId("at").textContent).toBe("closed");
});

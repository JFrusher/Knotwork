import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { CONTROLLER } from "@/lib/legal";
import { Footer } from "./Footer";

test("offers an email for saying what is missing, carrying nothing from the wedding", () => {
  render(<Footer />);
  const link = screen.getByRole("link", { name: "Something missing? Tell me." });
  const href = new URL(link.getAttribute("href")!);

  expect(href.protocol).toBe("mailto:");
  expect(href.pathname).toBe(CONTROLLER.email);
  expect(href.searchParams.get("subject")).toBe("Something missing from Knotwork");
  // Only a subject: nothing from the plan goes unless the couple writes it.
  expect([...href.searchParams.keys()]).toEqual(["subject"]);
});

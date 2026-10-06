import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CONTROLLER } from "@/lib/legal";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("lets someone without a GitHub account say what's missing, by email, attaching nothing", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "Something missing? Tell me." });
    expect(link.getAttribute("href")).toBe(
      `mailto:${CONTROLLER.email}?subject=${encodeURIComponent("Something missing from Knotwork")}`,
    );
  });
});

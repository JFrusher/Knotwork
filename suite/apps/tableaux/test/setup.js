/**
 * Registers the DOM matchers Tableaux's component tests are written against
 * (`toBeInTheDocument`, `toHaveClass`, and the rest). They were ambient in its
 * own repo; here each tool's project declares what it needs, so nothing is
 * silently relying on another tool's setup.
 */
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/*
 * Seating's store writes through the wedding's, which saves to IndexedDB.
 * There is none in jsdom, and nothing here is about storage.
 */
vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

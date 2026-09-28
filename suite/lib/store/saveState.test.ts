import { describe, expect, it } from "vitest";
import { saveState } from "./saveState";

const settled = {
  status: "ready" as const,
  error: null,
  saveError: null,
  savedAt: null,
  cloudStatus: "disabled" as const,
  cloudError: null,
};

describe("what the header says about saving", () => {
  it("says saved when there is nothing wrong and no account", () => {
    expect(saveState(settled)).toMatchObject({ label: "Saved", tone: "ok" });
  });

  it("says synced when the account has it too", () => {
    expect(saveState({ ...settled, cloudStatus: "idle" })).toMatchObject({ label: "Synced", tone: "ok" });
  });

  it("says a failed save out loud, with the reason", () => {
    const state = saveState({ ...settled, saveError: "The wedding could not be saved: quota exceeded" });
    expect(state).toMatchObject({ label: "Not saved", tone: "danger" });
    expect(state.detail).toContain("quota exceeded");
  });

  it("puts a failed save ahead of anything the cloud is doing", () => {
    // The cloud can only have what this device stored; if the device did not
    // store it, "Synced" would be a claim about an edit nobody has.
    const state = saveState({ ...settled, saveError: "full", cloudStatus: "idle" });
    expect(state.label).toBe("Not saved");
  });

  it("puts an unreadable wedding ahead of everything", () => {
    const state = saveState({ ...settled, status: "error", error: "Bad bytes.", saveError: "full" });
    expect(state).toMatchObject({ label: "Can't open", tone: "danger" });
  });

  it("asks for a choice when the cloud has a conflict", () => {
    expect(saveState({ ...settled, cloudStatus: "conflict" })).toMatchObject({ label: "Needs you", tone: "warn" });
  });

  it("tells offline apart from a cloud that answered with a failure", () => {
    expect(saveState({ ...settled, cloudStatus: "queued" }).label).toBe("Offline");
    expect(saveState({ ...settled, cloudStatus: "error" }).label).toBe("Not synced");
  });
});

import type { KnotworkState } from "./useKnotworkStore";

/**
 * What the header says about where the wedding is kept, in one word.
 *
 * Every state the store can be in reduces to one of these, in order of what
 * matters most: a wedding that could not be read, then an edit that could not
 * be stored, then anything that needs the couple to choose, then the cloud's
 * own weather. Only the first match is shown — two warnings side by side in a
 * header is one too many to read.
 */

export type SaveTone = "ok" | "busy" | "warn" | "danger";

interface SaveState {
  /** One or two words, for the pill. */
  label: string;
  tone: SaveTone;
  /** A sentence, for the tooltip and for screen readers. */
  detail: string;
}

type Inputs = Pick<
  KnotworkState,
  "status" | "error" | "saveError" | "savedAt" | "cloudStatus" | "cloudError"
>;

export function saveState(s: Inputs): SaveState {
  if (s.status === "error") {
    return {
      label: "Can't open",
      tone: "danger",
      detail: `${s.error ?? "The saved wedding could not be read."} Nothing has been written over it.`,
    };
  }
  if (s.saveError) {
    return {
      label: "Not saved",
      tone: "danger",
      detail: `${s.saveError} Your latest changes are on screen but not stored — export a backup from Data.`,
    };
  }

  switch (s.cloudStatus) {
    case "conflict":
      return {
        label: "Needs you",
        tone: "warn",
        detail: "You and someone else changed the same part of the wedding. Choose which to keep.",
      };
    case "choosing":
      return {
        label: "Needs you",
        tone: "warn",
        detail: "This device and your account hold different weddings. Choose which to keep.",
      };
    case "error":
      return {
        label: "Not synced",
        tone: "warn",
        detail: `${s.cloudError ?? "The cloud could not be reached."} Your changes are saved on this device.`,
      };
    case "queued":
      return {
        label: "Offline",
        tone: "warn",
        detail: "Saved on this device. It syncs when you are back online.",
      };
    case "syncing":
      return { label: "Syncing", tone: "busy", detail: "Saved on this device, and syncing to your account." };
    case "idle":
      return { label: "Synced", tone: "ok", detail: "Saved on this device and to your account." };
    case "disabled":
      return {
        label: "Saved",
        tone: "ok",
        detail: s.savedAt
          ? `Saved on this device at ${new Date(s.savedAt).toLocaleTimeString()}.`
          : "Saved on this device.",
      };
  }
}

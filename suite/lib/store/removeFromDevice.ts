import { del, keys } from "idb-keyval";

/**
 * Printer calibration belongs to the printer beside this device, not to any
 * wedding — it stays when a wedding goes.
 */
const DEVICE_KEYS = new Set(["plaque.printers", "plaque.printer.active"]);

/**
 * Everything the wedding left on this device: the document, its link to the
 * account, kept copies, fonts and artwork. For signing out of a computer that
 * is not yours.
 */
export async function removeWeddingFromDevice(): Promise<void> {
  for (const key of await keys()) {
    if (!DEVICE_KEYS.has(String(key))) await del(key);
  }
}

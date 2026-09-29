import { del, keys } from "idb-keyval";
import { TAKEN_PREFIX } from "@/lib/binder/binder";

/**
 * Printer calibration belongs to the printer beside this device, not to any
 * wedding — it stays when a wedding goes.
 */
const DEVICE_KEYS = new Set(["plaque.printers", "plaque.printer.active"]);

/**
 * Everything the wedding left on this device: the document, its link to the
 * account, kept copies, fonts and artwork, and which of its photos the Binder
 * has ticked off. For signing out of a computer that is not yours. That this
 * device has seen the tour is the device's, and stays.
 */
export async function removeWeddingFromDevice(): Promise<void> {
  for (const key of await keys()) {
    if (!DEVICE_KEYS.has(String(key))) await del(key);
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(TAKEN_PREFIX)) localStorage.removeItem(key);
  }
}

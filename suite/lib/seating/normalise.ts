import { splitTitle } from "@/lib/model/partners";
import { hasLegacyGuests, hasLegacyShots, readGuests, readSeating, readShots } from "@/lib/model/slices";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { reconcile } from "./actions";

/**
 * Bring a freshly loaded document's two records of a seat back into agreement.
 *
 * A seat is stored twice — on the table and on the guest — and a document that
 * arrives from somewhere else may already disagree: an older export, a
 * hand-edited file, or two of the original standalone apps that were never
 * reconciled. The Trousseau validator refuses a commit over exactly this, so it
 * is fixed on the way in rather than carried around.
 *
 * Called after a load, never during editing: the actions keep both sides true
 * from then on. A no-op writes nothing, so a clean document is not touched.
 *
 * The same pass converts what older versions stored differently: diets as the
 * file's words rather than a key, sides and group-shot roles as "bride" and
 * "groom" rather than after the partners, and the partners themselves only as
 * a title.
 */
export function reconcileLoadedDocument(): void {
  const { doc, raw, status, setSlice } = useTrousseauStore.getState();
  if (status !== "ready") return;

  const before = readGuests(doc);
  const after = reconcile({ guests: before, seating: readSeating(doc) });
  // Silent: the user did not make this change, and undoing back into a
  // knowingly inconsistent document would help nobody. Also written when the
  // stored guests or shots still hold something reading them has already
  // converted — the old importer's dietary text, "bride" and "groom" — so a
  // document is converted once rather than on every read.
  if (after.guests !== before || hasLegacyGuests(raw["guests"])) {
    setSlice("guests", after.guests, { silent: true });
  }
  if (hasLegacyShots(raw["shots"])) setSlice("shots", readShots(doc), { silent: true });

  // A wedding named before the partners were stored apart: "Alex & Sam" is
  // two people, and each side of the family is named after one of them.
  const [a, b] = doc.event.partners;
  const split = !a && !b ? splitTitle(doc.event.coupleNames) : null;
  if (split) setSlice("event", { ...doc.event, partners: split }, { silent: true });
}

import { useMemo } from "react";
import type { Artefact } from "../core/data/artefacts";
import { printBasis, sincePrinted, type Printed } from "../state/printed";
import { usePlaque } from "../state/store";

/**
 * What the room has changed since this piece last went to the printer, and the
 * shortest way to put it right: the cards that would now come out differently,
 * on their own.
 */
export function SincePrinted({
  printed,
  artefacts,
  className,
  actionClassName,
}: {
  printed: Printed | null;
  artefacts: Artefact[];
  className: string;
  actionClassName: string;
}) {
  const template = usePlaque((s) => s.template);
  const room = usePlaque((s) => s.room);
  const since = useMemo(
    () => (printed ? sincePrinted(printed, artefacts, printBasis(template, room)) : null),
    [printed, artefacts, template, room],
  );
  if (!printed || !since || (since.changed.length === 0 && since.gone.length === 0)) return null;

  const when = new Date(printed.at).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const { changed, gone } = since;
  const names = changed.slice(0, 3).map((a) => a.label).join(", ") + (changed.length > 3 ? `, and ${changed.length - 3} more` : "");
  const goneText =
    gone.length === 0 ? "" : ` ${gone.length === 1 ? "One card" : `${gone.length} cards`} printed then ${gone.length === 1 ? "is" : "are"} no longer needed.`;

  return (
    <p className={className} role="status">
      {changed.length === 0
        ? `Since this was printed on ${when}:${goneText}`
        : artefacts.length === 1
          ? `This has changed since it was printed on ${when}.${goneText}`
          : `Since this was printed on ${when}, ${changed.length === 1 ? "one card has" : `${changed.length} cards have`} changed: ${names}.${goneText}`}
      {changed.length > 0 && artefacts.length > 1 && (
        <button
          type="button"
          className={actionClassName}
          onClick={() => usePlaque.getState().setPrintOnly(changed.map((a) => a.key))}
        >
          Print just {changed.length === 1 ? "that one" : `these ${changed.length}`}
        </button>
      )}
    </p>
  );
}

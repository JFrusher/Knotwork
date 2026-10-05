import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { normalise } from "../../core/data/artefacts";
import { artefactsOf } from "../../core/data/parts";
import { stampableChairs } from "../../core/template/room";
import type { RoomElement } from "../../core/types";
import { stampedChairs, usePlaque } from "../../state/store";
import { Hint, SubGroup } from "../controls";
import styles from "./StampChairs.module.css";

/** How many uncovered chairs are named before "and n more". */
const NAMED = 8;

/**
 * The plan's names as boxes of their own, one per chair, to restyle one by one
 * or to place over artwork — and the chairs that have none yet.
 */
export function StampChairs({ element }: { element: RoomElement }) {
  const { template, room, rows, headers, rowIds, previewGuestIndex, stampChairs } = usePlaque(
    useShallow((s) => ({
      template: s.template,
      room: s.room,
      rows: s.rows,
      headers: s.headers,
      rowIds: s.rowIds,
      previewGuestIndex: s.previewGuestIndex,
      stampChairs: s.stampChairs,
    })),
  );

  const uncovered = useMemo(() => {
    const artefacts = artefactsOf(template, rows, headers, rowIds);
    const row = (artefacts[previewGuestIndex] ?? artefacts[0])?.row ?? {};
    const covered = new Set(stampedChairs(template, element.id));
    return stampableChairs(element, room, row).filter((c) => !covered.has(`${c.table === null ? "" : normalise(c.table)}#${c.seat}`));
  }, [template, room, rows, headers, rowIds, previewGuestIndex, element]);

  const stamped = stampedChairs(template, element.id).length;
  const tableWise = element.show === "table";

  return (
    <SubGroup title="Names as boxes of their own">
      {stamped === 0 ? (
        <>
          <Hint>
            A text box at every chair this plan names, each bound to its chair: restyle any of them, or move
            them over your own artwork.
            {tableWise ? " On a table's own map they always follow their chairs: every table is shaped differently." : ""}
          </Hint>
          <div className={styles.actions}>
            <button type="button" className={styles.button} disabled={uncovered.length === 0} onClick={() => stampChairs(element.id, true)}>
              Boxes that follow the plan
            </button>
            {!tableWise && (
              <button type="button" className={styles.button} disabled={uncovered.length === 0} onClick={() => stampChairs(element.id, false)}>
                Boxes that stay where I put them
              </button>
            )}
          </div>
          {uncovered.length === 0 && (
            <Hint>
              {room.tables.length === 0
                ? "There is no seating plan yet. Add tables in Seating, and their chairs appear here."
                : "No table here numbers its seats, so there are no chairs to name. Set a table to number its seats in Seating."}
            </Hint>
          )}
        </>
      ) : uncovered.length === 0 ? (
        <Hint>Every chair has its box ({stamped}).</Hint>
      ) : (
        <>
          <Hint>
            {uncovered.length === 1 ? "One chair has" : `${uncovered.length} chairs have`} no box:{" "}
            {uncovered
              .slice(0, NAMED)
              .map((c) => c.label)
              .join(", ")}
            {uncovered.length > NAMED ? `, and ${uncovered.length - NAMED} more` : ""}.
          </Hint>
          <div className={styles.actions}>
            {uncovered.slice(0, NAMED).map((c) => (
              <button
                key={c.label}
                type="button"
                className={styles.chip}
                onClick={() => stampChairs(element.id, followOf(template, element.id), [c])}
              >
                + {c.label}
              </button>
            ))}
            <button type="button" className={styles.button} onClick={() => stampChairs(element.id, followOf(template, element.id))}>
              Add all {uncovered.length}
            </button>
          </div>
        </>
      )}
    </SubGroup>
  );
}

/** New boxes join the old ones: following if they follow, staying if they stay. */
function followOf(template: { elements: Array<{ kind: string; chair?: { from: string; follow: boolean } }> }, roomId: string): boolean {
  return template.elements.some((el) => el.kind === "text" && el.chair?.from === roomId && el.chair.follow);
}

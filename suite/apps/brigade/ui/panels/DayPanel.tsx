import Link from "next/link";
import { formatClock } from "../../core/time/minutes";
import { useBrigadeDoc } from "../../state/store";
import { Panel } from "@/components/ui/fields";
import styles from "./DayPanel.module.css";

/**
 * The day the jobs hang off. Read-only here: the timeline owns it and publishes
 * it into the wedding on every edit, so a block moved there moves here without
 * anybody importing anything.
 */
export function DayPanel() {
  const day = useBrigadeDoc().day;

  return (
    <Panel title="The day" data-tour="delegation.day">
      {day === null ? (
        <p className={styles.none}>
          No day yet. Build it in <Link href="/timeline">Timeline</Link> and it appears here.
        </p>
      ) : (
        <dl className={styles.summary}>
          <dt>Day</dt>
          <dd>{day.coupleNames || "No names"}</dd>
          <dt>Venue</dt>
          <dd>{day.venueName || "—"}</dd>
          <dt>Date</dt>
          <dd>{day.date}</dd>
          <dt>Blocks</dt>
          <dd>
            {day.blocks.length}, {formatClock(spanOf(day.blocks).fromMin)} to{" "}
            {formatClock(spanOf(day.blocks).toMin)}
          </dd>
        </dl>
      )}
    </Panel>
  );
}

function spanOf(blocks: { startMin: number; endMin: number }[]): { fromMin: number; toMin: number } {
  if (blocks.length === 0) return { fromMin: 0, toMin: 0 };
  return {
    fromMin: Math.min(...blocks.map((block) => block.startMin)),
    toMin: Math.max(...blocks.map((block) => block.endMin)),
  };
}

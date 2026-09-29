import { useMemo } from "react";
import { pairKey, travelPairs } from "../../core/schedule/travel";
import { useSchedule, useStore, useTimelineDoc } from "../../state/store";
import { Button, Panel } from "@/components/ui/fields";
import { WholeNumberInput } from "@/components/ui/WholeNumberInput";
import fields from "@/components/ui/fields.module.css";
import styles from "./TravelPanel.module.css";

/**
 * How long it takes to get between the places the day moves between.
 *
 * Only the pairs somebody actually travels between are listed, so there is
 * nothing to invent: a blank is a journey nobody is checked against, which is
 * right for two rooms next door to each other.
 */
export function TravelPanel() {
  const doc = useTimelineDoc();
  const { resolved } = useSchedule();
  const setJourney = useStore((state) => state.setJourney);
  const { used, unused } = useMemo(() => travelPairs(resolved, doc), [resolved, doc]);

  return (
    <Panel title="Travel">
      <p className={styles.hint}>
        How long it takes to get from one place to the other. Anybody tagged at both is checked against it. To have
        the two of you checked, tag your own blocks — “couple”, say.
      </p>

      {used.length === 0 && <p className={styles.empty}>Tag blocks in two different places and the journey between them appears here.</p>}

      <ul className={styles.list}>
        {used.map((pair) => {
          const [from, to] = pair.between;
          return (
            <li key={pairKey(from, to)} className={styles.row}>
              <span className={styles.places}>
                <span className={styles.name}>
                  {from} – {to}
                </span>
                <span className={styles.who}>{pair.who.join(", ")}</span>
              </span>
              <WholeNumberInput
                label={`Minutes between ${from} and ${to}`}
                value={pair.minutes}
                onCommit={(minutes) => setJourney(pair.between, minutes)}
                className={`${fields.input} ${styles.minutes}`}
              />
              <span className={styles.unit}>min</span>
            </li>
          );
        })}
      </ul>

      {unused.length > 0 && (
        <div className={styles.unused}>
          <h3 className={styles.unusedTitle}>No longer on the day</h3>
          <ul className={styles.list}>
            {unused.map((journey) => (
              <li key={pairKey(...journey.between)} className={styles.unusedRow}>
                <span className={styles.name}>
                  {journey.between[0]} – {journey.between[1]}, {journey.minutes} min
                </span>
                <Button variant="quiet" onClick={() => setJourney(journey.between, null)}>
                  Forget
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

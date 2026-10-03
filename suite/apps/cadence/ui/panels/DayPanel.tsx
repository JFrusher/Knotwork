import { formatClock } from "../../core/time/minutes";
import { useSchedule, useStore, useTimelineDoc } from "../../state/store";
import { Button, Field, NumberField, Panel, Row, TimeField } from "@/components/ui/fields";
import { useDataPanel } from "@/components/shell/dataPanel";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import styles from "./DayPanel.module.css";

const OFFSETS = [
  { value: 0, label: "UTC (GMT)" },
  { value: 60, label: "UTC+1 (BST, CET)" },
  { value: 120, label: "UTC+2 (CEST)" },
  { value: -300, label: "UTC-5 (EST)" },
  { value: -240, label: "UTC-4 (EDT)" },
];

/**
 * The day's settings: the facts of the wedding, shown, and Timeline's own
 * inputs, edited.
 *
 * The couple, the venue and the date belong to the wedding, and are changed in
 * one place — the Data panel. They used to be editable here as well, and in
 * Seating, and each copy wrote itself back over the others. The curfew, the
 * clocks and the venue's coordinates are the schedule's alone, and stay here.
 */
export function DayPanel() {
  const doc = useTimelineDoc();
  const setDay = useStore((state) => state.setDay);
  const sun = useSchedule().sun;
  // Live from the wedding rather than from Timeline's copy of it.
  const event = useKnotworkStore((state) => state.doc.event);
  const showData = useDataPanel((state) => state.show);

  return (
    <Panel title="The day">
      <div className={styles.facts}>
        <p className={styles.couple}>{event.coupleNames || "No names yet"}</p>
        <p className={styles.where}>
          {[event.venueName, event.date ? longDate(event.date) : "No date yet"].filter(Boolean).join(" · ")}
        </p>
        <Button onClick={showData}>
          Change names, date or venue
        </Button>
      </div>

      <TimeField
        label="Curfew"
        value={doc.day.curfewMin}
        onChange={(curfewMin) => setDay({ curfewMin })}
        hint="Everything must be finished by this. Past midnight, type 01:00 +1."
      />

      <Row>
        <NumberField
          label="Latitude"
          value={doc.day.latitude}
          min={-90}
          max={90}
          step={0.0001}
          onChange={(latitude) => setDay({ latitude })}
        />
        <NumberField
          label="Longitude"
          value={doc.day.longitude}
          min={-180}
          max={180}
          step={0.0001}
          onChange={(longitude) => setDay({ longitude })}
        />
      </Row>

      <Field label="Clocks" hint="Entered, not guessed. British Summer Time is UTC+1.">
        <select
          className={styles.date}
          // "" until chosen, so the first choice is a change even when it is
          // British Summer Time, and nothing is shown as chosen that was not.
          value={doc.day.utcOffsetMin ?? ""}
          onChange={(event) => setDay({ utcOffsetMin: Number(event.target.value) })}
        >
          <option value="" disabled>
            Not set
          </option>
          {OFFSETS.map((offset) => (
            <option key={offset.value} value={offset.value}>
              {offset.label}
            </option>
          ))}
        </select>
      </Field>

      <p className={styles.sun}>
        {doc.day.utcOffsetMin === null
          ? "Set the clocks to see sunset and golden hour."
          : sun?.sunsetMin == null
          ? "The sun does not set at this latitude on this date."
          : `Sunset ${formatClock(sun.sunsetMin)}, golden hour from ${formatClock(sun.goldenHourStartMin ?? sun.sunsetMin)}.`}
      </p>
    </Panel>
  );
}

function longDate(iso: string): string {
  const when = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(when.getTime())) return iso;
  return when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

import { useShallow } from "zustand/react/shallow";
import { DEFAULT_CHAIR_NAME, chairName } from "../../core/template/chairs";
import { useStationery } from "../../state/store";
import { Hint, TextField } from "../controls";
import styles from "./NameFormat.module.css";

/** Formats people reach for, offered one click away. */
const SUGGESTED = [
  { label: "Ada Byron", pattern: "{{First Name}} {{Last Name}}" },
  { label: "Ada", pattern: "{{First Name}}" },
  { label: "Ada B.", pattern: "{{First Name}} {{Last Initial}}" },
  { label: "Byron, Ada", pattern: "{{Last Name}}, {{First Name}}" },
] as const;

/**
 * How this design names a guest by their chair — on its plans, and wherever it
 * says `{{At seat 3}}` or `{{Table 1, seat 3}}`. One setting for the design,
 * written in the guest's own tokens, shown on a few real guests as it is typed.
 */
export function NameFormat() {
  const { pattern, rows, setChairName } = useStationery(
    useShallow((s) => ({ pattern: s.template.chairName ?? DEFAULT_CHAIR_NAME, rows: s.rows, setChairName: s.setChairName })),
  );
  const sample = rows.slice(0, 3);

  return (
    <div className={styles.format}>
      <TextField
        label="Names by their chair"
        value={pattern}
        placeholder={DEFAULT_CHAIR_NAME}
        onChange={(next) => setChairName(next)}
      />
      <div className={styles.choices}>
        {SUGGESTED.map((s) => (
          <button
            key={s.pattern}
            type="button"
            className={s.pattern === pattern ? `${styles.choice} ${styles.active}` : styles.choice}
            aria-pressed={s.pattern === pattern}
            onClick={() => setChairName(s.pattern)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sample.length > 0 && (
        <Hint>
          Reads: {sample.map((row) => chairName({ chairName: pattern }, row) || "(nothing)").join(" · ")}
        </Hint>
      )}
      <Hint>A guest given a name of their own in Guests, under Known as, is called that instead.</Hint>
    </div>
  );
}

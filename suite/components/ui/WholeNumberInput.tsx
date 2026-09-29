"use client";

/**
 * A whole number, or nothing: written when you leave the field or press Enter,
 * never per keystroke. An emptied box is nothing — "not agreed", "no time
 * typed" — rather than a zero, and the caller says which it means.
 *
 * Styled by the caller, so the pages' kit and the tools' kit can both use it.
 */
export function WholeNumberInput({
  label,
  value,
  onCommit,
  className,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  className: string;
}) {
  return (
    <input
      // Keyed on the stored value, so an undo shows through.
      key={value ?? "none"}
      type="number"
      min={0}
      step={1}
      aria-label={label}
      defaultValue={value ?? ""}
      placeholder="—"
      onBlur={(event) => {
        const text = event.target.value.trim();
        const next = text === "" ? null : Math.max(0, Math.round(Number(text)));
        if (next !== value && (next === null || Number.isFinite(next))) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={className}
    />
  );
}

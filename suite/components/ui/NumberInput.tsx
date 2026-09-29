"use client";

/**
 * A number, or nothing: written when you leave the field or press Enter,
 * never per keystroke. An emptied box is nothing — "not agreed", "no time
 * typed" — rather than a zero, and the caller says which it means.
 *
 * Whole numbers unless given a `step`, which it rounds to: 0.25 for hours,
 * 0.01 for a price.
 *
 * Styled by the caller, so the pages' kit and the tools' kit can both use it.
 */
export function NumberInput({
  label,
  value,
  onCommit,
  className,
  step = 1,
  placeholder = "—",
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  className: string;
  step?: number;
  placeholder?: string;
}) {
  const places = (String(step).split(".")[1] ?? "").length;
  return (
    <input
      // Keyed on the stored value, so an undo shows through.
      key={value ?? "none"}
      type="number"
      min={0}
      step={step}
      aria-label={label}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      onBlur={(event) => {
        const text = event.target.value.trim();
        const next = text === "" ? null : Number((Math.max(0, Math.round(Number(text) / step)) * step).toFixed(places));
        if (next !== value && (next === null || Number.isFinite(next))) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={className}
    />
  );
}

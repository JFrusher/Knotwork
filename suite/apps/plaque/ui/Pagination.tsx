import styles from "./Pagination.module.css";

export interface PaginationProps {
  index: number;
  count: number;
  onChange: (index: number) => void;
  /** What is being paged through, one and many: the card pane pages cards. */
  noun: { one: string; many: string };
}

export function Pagination({ index, count, onChange, noun }: PaginationProps) {
  const clamp = (n: number) => Math.max(0, Math.min(count - 1, n));
  return (
    <nav className={styles.bar} aria-label={noun.many}>
      <button type="button" onClick={() => onChange(clamp(index - 1))} disabled={index <= 0}>
        ‹ Prev
      </button>
      <span className={styles.label} aria-live="polite">
        {count === 0 ? `No ${noun.many.toLowerCase()}` : `${noun.one} ${index + 1} of ${count}`}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(index + 1))}
        disabled={count === 0 || index >= count - 1}
      >
        Next ›
      </button>
    </nav>
  );
}

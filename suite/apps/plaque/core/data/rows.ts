/** One guest, keyed by column. Values are trimmed strings — never undefined. */
export type GuestRow = Record<string, string>;

/** Something about the list worth telling the user, such as guests with no table. */
export interface RowIssue {
  /** 1-based row, or null for a problem with the list as a whole. */
  row: number | null;
  message: string;
}

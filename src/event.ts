import { z } from "zod";

/**
 * The facts every app needs and none uniquely owns: who, where, when.
 *
 * Owned by the launcher. Cadence carries the same fields inside its own
 * document and echoes them into `day.day.*`; that echo is a copy, and this is
 * authoritative.
 *
 * Every field has a default because an event is half-filled for most of its
 * life. A missing venue is a normal state, not a validation failure — refusing
 * to parse would mean an app could not read the couple's names until someone
 * had chosen a venue.
 */
export const eventSchema = z.looseObject({
  date: z.string().default(""),
  /**
   * What the wedding is called on every title — "Alex & Sam". Written from
   * `partners` by the one place they are edited, and kept so that everything
   * printing a title can go on reading one string.
   */
  coupleNames: z.string().default(""),
  /**
   * The two people getting married, each by the name the guests know them by.
   * Their own names are what the suite calls each side of the family and each
   * person in the group shots — "Alex's side", "Sam's mother" — rather than
   * "bride" and "groom", which described one kind of couple.
   */
  partners: z.tuple([z.string(), z.string()]).default(["", ""]),
  venueName: z.string().default(""),
  /** Minutes from the day's 00:00, as everywhere in Cadence. */
  curfewMin: z.number().nullable().default(null),
  utcOffsetMin: z.number().nullable().default(null),
});

export type Event = z.infer<typeof eventSchema>;

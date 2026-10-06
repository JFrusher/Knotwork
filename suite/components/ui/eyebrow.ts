/**
 * The small capitals that label a section, a card or a step.
 *
 * One class string so every label in the suite is the same size and spacing.
 * Colour is left to the caller: most are `text-slate`, a late checklist
 * section is `text-danger`. Kept out of `controls.tsx` because that module is
 * client-only and server pages use this too.
 */
export const EYEBROW = "text-xs tracking-widest uppercase";

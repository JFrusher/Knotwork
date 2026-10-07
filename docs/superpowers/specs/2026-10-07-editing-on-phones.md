# Editing on phones

Issue #84. Decided with the maintainer on 2026-10-07: the gate is per tool, the list-shaped tools come first, and the canvases stay desktop.

## Where it stands on `main`

The issue says the editing tools are all replaced by a gate below 1024px. That is no longer the whole picture:

- The gate is already per tool. `LandscapeGate` (`suite/components/shell/LandscapeGate.tsx`) wraps only the `(tools)` route group and reads each tool's `wide` flag in `suite/lib/tools.ts`.
- **Guests, Money, Checklist and Binder already open on a phone.** Money, Checklist and Binder have `wide: false`; Guests is a tab outside the gated group.
- Gated (`wide: true`): Seating, Stationery, Timeline, Delegation, Group shots, Ceremony, Boxes, Bar.

So "what the gate becomes" is answered: per tool, by `wide`, as now. Each tool below moves by turning its `wide` to `false` once it works at 390px.

## Order

List-shaped first, one sub-issue each:

1. **Bar.** Its sheet already stacks below 1024px (it is shared with the public calculator, which is tested at phone width). Turn `wide` off and check the Timeline hours pickers fit.
2. **Boxes.** A list of boxes and their items.
3. **Group shots.** The shot list and the inspector, one above the other.
4. **Delegation's jobs.** The board is already a single column of blocks in clock order; the crew panel moves below it.

Staying desktop: **Seating** and **Stationery** (canvases), **Timeline** (a drag-to-scale lane view) and **Ceremony** (the processional is drawn). Seating on a phone would be "move a guest to another table" from Guests, which Guests can already do.

## One way

Responsive versions of the same components, with Tailwind breakpoints at `lg` (1024px), the gate's own width. No second mobile app and no phone-only components.

## Done when, for each tool

- Its `wide` is `false` in `lib/tools.ts`.
- At 390px there is no horizontal page scroll, and every control is reachable.
- `e2e/a11y.spec.ts` runs axe on it at 390px as well as 1440px.
- The decisions log records the change.

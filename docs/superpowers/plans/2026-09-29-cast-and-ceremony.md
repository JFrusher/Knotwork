# One Cast, and Ceremony Implementation Plan

**Goal:** The people a wedding is built around — the couple, their parents
and grandparents, their wedding parties, and roles of the couple's own
devising — are recorded once and shared by Group shots and a new Ceremony tool,
which plans the processional: who walks, in what order, how, and to what music.

**Architecture:** The cast leaves the `shots` slice for a slice of its own,
`cast`, since two tools now edit it and a tool writes only its own slice. It is
moved by the load-time pass that already converts older shapes, and read from
either place until then, so a document the server reads before any browser
has loaded it still has its cast. Ceremony is built as Group shots was: a
slice, `ceremony`; pure actions over it; a page that reads and writes the
wedding directly, on its one history. A processional group's members are the
same kinds a shot's are, resolved by the same code.

**Tech Stack:** TypeScript, the suite's kit, pdf-lib for the page. **No new
dependencies.**

**Spec:** [Phase 2 of the toolbox spec](../specs/2026-09-29-toolbox-and-new-tools-design.md#phase-2--one-cast-and-ceremony)

## 2a — One cast

- [x] `cast` joins the contract's slices. `CastSlice { roles: Cast; customRoles }`.
- [x] `readCast(doc)`: the `cast` slice, or — for a document not yet converted —
  the cast and custom roles still inside `shots`, old role names included.
  `Shots` keeps only its sections.
- [x] The load-time pass writes the cast to its own slice and takes it out of
  `shots`, silently, as it converts "bride" and "groom".
- [x] Each partner's grandparents join the fixed roles, as a party role.
- [x] Group shots reads and writes the cast there; "Who's who" edits `cast`.
  Readiness, the front page, the prints and the validator follow.

## 2b — Ceremony

- [x] `ceremony` joins the contract's slices: `{ processional: WalkGroup[] }`,
  a group being a label, members (the shot's member kinds), how they walk
  (alone, in pairs, in threes), which side they go to, and a cue — the music,
  and when it changes.
- [x] Pure actions: add, change, move, remove a group; add and remove members.
- [x] *Suggest an order* from the cast: the officiant, grandparents, parents,
  the wedding parties, then the couple — a starting point, every part of it
  editable, and nothing in it assuming who walks with whom.
- [x] Checks: somebody walking who has declined; a role nobody has been cast
  in. What is left and the front page say so, when Ceremony is shown.
- [x] The page, `/ceremony`: the order on the left, the picked group on the
  right, with the member picker Group shots uses (moved to be shared).
  Registered as a tool, off until added.
- [x] The example wedding gets a processional, since it shows every tool.
- Not done, on purpose: a tour chapter. The tour is held to under thirty steps
  and has twenty-nine; Ceremony's list carries the anchor one would point at
  (`ceremony.order`) for when a chapter elsewhere is trimmed.
- The resolver both tools use moved to `lib/cast/resolve` as `resolveMembers`,
  taking any group with a label and members; its words no longer say "shot".

## 2c — Paper, and planners

- [x] One page for the officiant and whoever runs the day, and the order as
  plain text to paste into an email. The page joins the wedding pack.
- [x] The library keeps a processional: its groups, roles and cues, with no
  guest named.

## Status

**Complete — 2a, 2b and 2c, 2026-09-29.** 1,816 suite tests and 110 in the
contract package, typecheck and build clean, all 96 Playwright tests green.
No new dependencies. **One migration**, `20260929000004_library_processional`,
widening the library's kinds: apply it before deploying, as every migration.

**What executing it found.**

- The cast is read from either place, not only after the load pass has
  moved it, because the planner's Weddings page runs What is left on the
  server over stored documents nobody has opened since.
- After parsing, the contract fills an absent slice with `{}`, so "this
  wedding has its own cast" is decided by what the slice holds, not by its
  being there.
- Group shots' resolver was already the right shape for a processional — a
  label and members — so it moved to `lib/cast/resolve` rather than being
  copied; "Who's in it" became one `MemberPicker`; Money's nullable number
  had already gone to the kit in Phase 1, and the guest picker went to
  `components/cast`.
- The processional's page and its email text are made from one list of rows,
  so they cannot disagree.
- The library's kinds are fixed in the database as well as in the code; the
  migration test proves a processional is kept and an unknown kind still is
  not.
- The officiant is words ("The officiant", "The registrar") rather than a
  crew member: nothing yet needs the link, and words were already a member
  kind.

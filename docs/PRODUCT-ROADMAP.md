# Knotwork — product roadmap

Status: **living document** — updated as decisions land, not a one-shot spec.
Started: 2026-09-02.

This is the record of turning Knotwork from a tool built for one wedding into
a real product other couples can use. It captures the vision, the
decomposition into independent subsystems, decisions already made, and open
questions per subsystem. Each subsystem gets its own dated design spec in
`docs/superpowers/specs/` once it's actually designed — this document links
out to those rather than duplicating them.

Baseline: `docs/superpowers/specs/2026-09-02-knotwork-architecture-audit.md`
— the architecture audit that preceded this pivot decision.

## Vision

Knotwork was built for one wedding, with the constraints that came from that
being honest: real guest names, four tools that must not overwrite each
other, a date that doesn't move. The wedding has now happened. The decision
is to keep building this — as a real product for other couples, not a
single-use tool being retired.

That changes requirements that were previously answered by "it's just us":
real authentication, real accounts, secure cloud storage instead of a
DVC-backed local file, and a data/legal posture that holds up for strangers'
weddings, not just the maintainer's own.

**This will always be free and open source.** Freemium was explicitly the
thing this project exists to not be — no paywalled tiers, no upsells on
someone's wedding. This is a load-bearing decision, not a placeholder: it
rules out billing infrastructure as a subsystem entirely, and puts real
weight on hosting-cost sustainability and licensing as open questions
instead (see subsystem F).

## Subsystem map

| # | Subsystem | Depends on | Status |
|---|---|---|---|
| A | Identity & accounts | — | ✅ [spec written](superpowers/specs/2026-09-02-identity-accounts-design.md) |
| B | Multi-tenant data & storage | A | ✅ **built** — [spec](superpowers/specs/2026-09-02-multitenant-storage-design.md), [plan](superpowers/plans/2026-09-02-multitenant-storage.md) complete 2026-09-07 |
| C | Cadence/suite de-duplication | — | ✅ specced and verified safe; **archiving the four standalone repos is four clicks in GitHub's Settings → Archive**, left to the maintainer rather than installing a CLI to do it |
| D | Tableaux's future | — | 🟡 **pass one built** — data boundary typed ([plan](superpowers/plans/2026-09-07-tableaux-data-boundary-typing.md), 2026-09-07); every file, tests included, is now TypeScript, and `allowJs` is off |
| E | Brigade's expanded scope | (loosely) A, B | ✅ **built** — [spec](superpowers/specs/2026-09-08-brigade-vendors-budget-tasks-design.md), [plan](superpowers/plans/2026-09-08-brigade-vendors-budget-tasks.md) complete 2026-09-08. E4 is a confirmation date, not a portal |
| F | Onboarding, billing & legal at product scale | A | ✅ **built** — [spec](superpowers/specs/2026-09-02-onboarding-billing-legal-design.md), [plan](superpowers/plans/2026-09-07-licensing-and-self-hosting.md) complete 2026-09-07; privacy/terms rewritten 2026-09-08 |
| H | Guided tour & example wedding | — | ✅ **built** — [spec](superpowers/specs/2026-09-07-guided-tour-design.md), [plan](superpowers/plans/2026-09-07-guided-tour.md) complete 2026-09-07 |
| I | Retention sweep for account weddings | B | ✅ **built** — `app/api/cron/sweep` deletes account weddings unwritten for 24 months (`lib/documents/retention.ts`), and the Privacy Policy states it |
| G | Multi-tenant suite mechanics | A, B | ✅ **built** — [spec](superpowers/specs/2026-09-02-multitenant-mechanics-design.md), [plan](superpowers/plans/2026-09-07-multitenant-mechanics.md) complete 2026-09-07 |
| J | Planner role and many weddings per account | A, G | ✅ **built** — [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md), phase 3: Weddings and library (2026-09-28) |
| K | Setup flow and signing in safely | A, B | ✅ **built** — [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md), phase 1: setup flow (2026-09-28) |
| L | Design language and shared kit | — | ✅ **built** — [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md), phase 0: shared kit and design language (2026-09-28) |
| M | Windows around the tools: Overview, Guests, Money, Checklist, Sync & history, palette | E, L | ✅ **built** — [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md), phase 2: guests, money, checklist and palette (2026-09-28) |
| N | Day-of binder and vendor links | E, J | ✅ **built** — [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md), phase 3: binder and supplier links (2026-09-29) |
| O | One live document: tools stop keeping copies; real-time sync | — | ✅ **built** — [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md), phase 4: real-time sync and presence (2026-09-29) |
| P | The toolbox, and travel, ceremony, boxes and bar | L, O | ✅ **built** — [spec](superpowers/specs/2026-09-29-toolbox-and-new-tools-design.md), plans for [the toolbox](superpowers/plans/2026-09-29-toolbox.md), [travel and calendars](superpowers/plans/2026-09-29-timeline-travel-and-calendars.md), [the cast and Ceremony](superpowers/plans/2026-09-29-cast-and-ceremony.md), [Boxes](superpowers/plans/2026-09-29-boxes.md) and [the Bar](superpowers/plans/2026-09-29-bar.md), 2026-09-29; the proposals joining tools to each other wait on the maintainer |

## Decisions log

Settled answers, in the order they were made. Each entry is a fact to build
against, not a discussion to reopen without a reason.

- **2026-09-02** — Scope: Knotwork becomes a real multi-tenant product for
  couples generally, not a single-wedding tool being wound down.
- **2026-09-02** — Tableaux: its "former standalone SaaS product" scar tissue
  (dead `planId`, references to a server that no longer exists, JS/no-schema
  boundary) is explicitly prunable. Nothing about Tableaux's current shape is
  sacred if it doesn't serve the product going forward.
- **2026-09-02** — Brigade: stays built on top of Cadence's published day (the
  slice-bridge pattern is sound and stays), but is expected to grow tasks
  beyond pure call-sheet generation. (What those tasks are is an open question
  for subsystem E.)
- **2026-09-02** — Data storage: DVC-backed local sync (`scripts/sync.mjs`,
  the OneDrive "remote") was a stopgap for one wedding on two laptops. It is
  explicitly being dropped in favor of real cloud storage for subsystem B —
  not extended or productionized.
- **2026-09-08** — Clarifying the above: "dropped" means it is not the
  product's sync story, **not** that the tooling is gone. `.githooks/pre-commit`
  still runs the cross-slice validator over `data/wedding.knotwork.json` on
  every commit and still catches real problems, and `scripts/sync.mjs` is still
  the maintainer's own two-machine workflow. Both stay. Deleting working
  tooling because a decision log calls it superseded is how you lose something
  you actually use.
- **2026-09-02** — Auth: Supabase Auth (already the vendor for the sync/
  sharing backend — no new provider).
- **2026-09-02** — Account model: two accounts per wedding. Whoever signs up
  first creates the wedding and invites their partner. Not a shared login.
- **2026-09-02** — Roles: couple-only for now. Guests stay link-based (no
  login, as today via `/seat/[token]`); vendors/crew stay link/PDF-based via
  Brigade, no logins for either in this phase.
- **2026-09-02** — Sign-in: email + magic link, no passwords, no social login
  for now.
- **2026-09-02** — Encryption: standard server-side encryption at rest +
  Postgres RLS, not true E2E. The current `/seat/[token]` E2E model is being
  left behind for regular account data — it can stay as-is for the guest
  share-link feature specifically if that still makes sense once B is
  designed in full, but it is not the model for a wedding's own data.
- **2026-09-02** — Storage shape: one JSON document per wedding, stored as
  Postgres JSONB, matching the existing zod contract package. Not normalized
  into per-domain relational tables.
- **2026-09-02** — Concurrency: compare-and-set conflict detection (reusing
  the existing pattern from the sync backend) with a "someone else edited
  this, refresh and reapply" notice on conflict. Not real-time collaborative
  editing, not slice-level locking.
- **2026-09-02** — Cadence de-duplication: retire the standalone `cadence`
  repo's role as a place development happens — `suite/apps/cadence` becomes
  the one canonical source. The standalone repo is **archived (via `gh`),
  never fully deleted** — this is a general policy for all the formerly-
  standalone repos (Plaque, Cadence, Brigade, Tableaux each has one), not
  Cadence-specific: history is kept, but nobody develops against it again.
- **2026-09-02** — Tableaux: *(revised same day — see below)* first decided
  as a full rewrite to TypeScript; reconsidered after realizing that risked
  losing working, audit-validated behavior for no real gain. **Revised
  decision: incremental in-place TypeScript migration** — same files, same
  logic, same behavior, converted progressively (allowJs during transition)
  with real schema validation added at the data boundary as it goes. Not a
  rewrite. Solid existing logic (CSV parser, warnings engine, per the audit)
  is typed in place, not redesigned.
- **2026-09-02** — Business model: always free and open source. No
  freemium, no paid tiers — explicitly the reason this project exists.
- **2026-09-02** — Hosting sustainability: hybrid — a maintainer-run hosted
  instance as the default for most users, self-hosting documented and
  genuinely supported as a secondary path (not just theoretically possible).
- **2026-09-02** — License: AGPL (currently MIT at the root — reconciling
  this is an open item under subsystem F).
- **2026-09-02** — Accounts-to-weddings: one active wedding per account for
  v1, no switcher UI. Additive-safe — can extend to multiple weddings per
  account later without redesigning the model.
- **2026-09-28** — A **planner role**, alongside the two partners. An account
  may be a partner in one wedding and a planner in any number; a wedding has
  at most one planner in v1. This is the "extend later" the entry above left
  room for. Detail in the
  [master plan](superpowers/specs/2026-09-28-expansion-master-plan.md).
- **2026-09-28** — Sides are named after the partners, not "bride" and
  "groom".
- **2026-09-28** — Phones get a read-only day-of binder; the editing tools
  stay desktop.
- **2026-09-28** — RSVPs stay with Joy and similar services; Knotwork imports
  the result through one importer that never unseats or silently deletes.
- **2026-09-28** — The guest link moves onto the account with no passphrase,
  and stays current by itself once published. `lib/sync` goes when it does.
- **2026-09-28** — Privacy promise restated: data may leave the device; nobody
  reads a couple's plans or their guests' names, and guest data never goes to
  a third party.
- **2026-09-28** — Every tool converges on the live document (no private
  copies, one undo). Seating goes last and becomes TypeScript as part of it.
  Supersedes the incremental-only Tableaux migration for its store layer.
- **2026-09-28** — Signing in never replaces a wedding silently. A device
  stores which account wedding it belongs to and what the two last agreed;
  two different weddings with work in both are asked about (whole weddings,
  not per part), and the one not chosen is kept as a copy on the device. A
  wedding is created at sign-in, except on the way to an invite. Replaces the
  offline write queue.
- **2026-09-28** — Roles: a wedding has up to two partners and one planner; an
  account is a partner in one wedding and a planner in any number. The couple
  sees who has access and can remove their planner. Each device holds one
  wedding at a time and switching is a swap through `/open`, never a merge.
- **2026-09-28** — The guest link moved onto the account and keeps itself
  current; the passphrase sync is deleted. The link's key is stored with the
  wedding, so it is as readable to the server's operator as the wedding is —
  stated in the Privacy Policy, which no longer describes the passphrase
  system.
- **2026-10-03** — Sign-in is a six-digit code sent by email (2026-10-02),
  replacing the magic link, with **Continue with Google** and **Continue with
  Apple** alongside it. Each provider shows only when it is switched on in
  Supabase. Still no passwords. This supersedes "no social login for now"
  from 2026-09-02.
- **2026-10-06** — The DVC tooling goes after all: `scripts/`, `.dvc/`,
  `data/*.dvc`, `.githooks/` and `docs/DATA.md`. This supersedes the
  2026-09-08 note keeping it; the cross-slice validator lives on in
  `suite/lib/documents/crossSliceValidation.ts`, which every document save
  runs. The data already pushed stays in its DVC remote.

## Subsystem H — Guided tour & example wedding

**Why:** Knotwork opens on an empty document with five unfamiliar tools and
nothing explaining that they share one wedding — which is the entire point of
the product and is invisible until you have done enough work to notice it. The
README explains it; almost nobody reads a README before using a web app.

**Decided:** an in-app guided overlay rather than a written guide (written ones
drift the moment the UI moves); explain-and-invite rather than gating steps on
real actions (every gate is somewhere a first-time user gets stuck); six
chapters of four to six steps, about five minutes end to end; hand-rolled
rather than a tour library; and a committed example wedding produced by driving
the real app and exporting, offered with a backup prompt rather than silently
replacing existing work.

**Built.** [`2026-09-07-guided-tour.md`](superpowers/plans/2026-09-07-guided-tour.md)
executed in full on 2026-09-07 (branch `guided-tour`). Six chapters, 29 steps,
an example wedding of 100 guests and 27 day blocks, and no new dependencies.

Executing it turned up five places where the app disagreed with the plan, and
the plan bent each time. The most useful: `Panel` in `components/ui/fields.tsx`
silently dropped any prop but `title` and `children`, several components render
different roots in their empty and populated states, and two Place cards panels
return fragments that cannot carry an attribute at all. Full list in the plan's
status section.

**Spec:** [`2026-09-07-guided-tour-design.md`](superpowers/specs/2026-09-07-guided-tour-design.md)
— includes fixing Timeline's **Sample day** button, which today replaces the
current day with no confirmation while the **New** button beside it does
confirm. Ready for an implementation plan.

## Subsystem A — Identity & accounts

**Why first:** almost every other subsystem assumes "a wedding belongs to an
authenticated account" already exists.

**What exists today to build from:** the `seat/[token]` sharing feature
already has a real, audited security model (unguessable token, key never
reaches the server, PBKDF2-derived encryption) — but it's a passphrase-based
share link, not an account system. Whether that crypto model survives contact
with real user accounts, or gets replaced by something more conventional
(server-side encryption at rest, standard session auth), is one of the first
things to decide.

**Decided:** Supabase Auth; two accounts per wedding via partner invite (not
a shared login); couple-only roles for now (guests and vendors/crew stay
link-based, no logins); no passwords. Sign-in started as an email magic link
and is now a six-digit emailed code, with Google and Apple alongside it (see
the decisions log, 2026-10-03).

**Spec written:** [`2026-09-02-identity-accounts-design.md`](superpowers/specs/2026-09-02-identity-accounts-design.md)
— one-click invite via emailed link (locked to the invited email, rejects a
mismatched signer), no separate email verification, long-lived sessions, and
wedding survives account deletion as long as one member remains. Ready for
an implementation plan.

## Subsystem B — Multi-tenant data & storage

**Depends on:** A (an account has to exist before deciding what it owns).

**What exists today:** a working, tested, end-to-end-encrypted Supabase sync
backend (`suite/lib/sync/`) built for the personal-use sharing feature, with
real migrations already written (some not yet applied to a live project per
the audit). This is a real head start, not a from-scratch problem — the open
question is how much of its model (passphrase-derived keys, single-wedding
assumption) needs to change for multi-tenant use.

**Decided:** standard server-side encryption + Postgres RLS (not E2E for
regular wedding data — the existing E2E model may still suit the guest
share-link feature specifically, revisit when this is designed in full); one
JSON document per wedding stored as JSONB, matching the existing zod
contract; compare-and-set conflict detection with a refresh-and-reapply
notice, not real-time collaboration.

**Built.** [`2026-09-02-multitenant-storage.md`](superpowers/plans/2026-09-02-multitenant-storage.md)
executed in full on 2026-09-07 (branch `multitenant-storage`). This unblocks
subsystem G, which was waiting on it.

**Spec:** [`2026-09-02-multitenant-storage-design.md`](superpowers/specs/2026-09-02-multitenant-storage-design.md)
— `wedding_documents` + append-only `wedding_document_history` (the DVC
version-history replacement), CAS-gated write path that also runs the
ported `validate-wedding.mjs` as a hard gate (errors block, warnings don't),
local storage demoted to an offline cache with queued-write replay, and the
existing E2E `suite/lib/sync/` backend left untouched, scoped to
`/seat/[token]` only. Ready for an implementation plan.

## Subsystem C — Cadence/suite de-duplication

**Independent of the pivot** — worth fixing regardless of what else gets
decided, and more urgent once there are many tenants instead of one wedding.
`suite/apps/cadence/` is a hand-ported mirror of the standalone `cadence`
repo; the same bug has to be fixed twice, and already wasn't (see the audit).

**Decided:** `suite/apps/cadence` becomes canonical; the standalone `cadence`
repo is archived via `gh` (not deleted) once its content is confirmed fully
absorbed. Same policy applies to the other three apps' standalone repo
histories.

**Spec written:** [`2026-09-02-cadence-deduplication-design.md`](superpowers/specs/2026-09-02-cadence-deduplication-design.md)
— verified via git log comparison that the standalone `cadence` repo has no
unported commits as of now, safe to archive. Execution is blocked on `gh`
CLI access on this machine (or use the GitHub web UI instead — either
works). The other three standalone repos get their own drift check in a
later pass, not this one.

## Subsystem D — Tableaux's future

**Revised same day:** first decided as a full TypeScript rewrite, then
reconsidered in favor of keeping current function and workings intact.

**Pass one built.** [`2026-09-07-tableaux-data-boundary-typing.md`](superpowers/plans/2026-09-07-tableaux-data-boundary-typing.md)
converted `store/planSchema` and `store/sliceBridge` to TypeScript and replaced
`planDocSchema`'s `.passthrough()` with real guest/table/room shapes.
The rest followed: Seating's source, then its last test files, are
TypeScript, and `suite/tsconfig.json` sets `"allowJs": false`. It says
`false` rather than leaving the key out, because `next build` adds
`"allowJs": true` to a tsconfig that has no `allowJs` at all.

Two corrections to the spec, both checked first: `checkJs` was deliberately
**not** enabled (it would type-check all 110 JS files at once — the flag day the
spec itself rules out; converting a file to `.ts` already opts it into
checking), and `planDocSchema` turned out to have no production callers at all,
so hardening it strengthens the round-trip tests rather than adding a runtime
guard.

**Worth carrying to the other apps:** typing a file does not catch a renamed
field on a loose slice. `eventSchema` is a `looseObject`, so its inferred type
has a catch-all index signature and `doc.event.anything` is `unknown`. Verified
by renaming `coupleNames` and watching `tsc` stay silent. `sliceBridge.ts` now
asserts against `eventSchema.shape` instead. **Cadence, Plaque and Brigade have
the same blind spot and no such guard.**

**Spec:** [`2026-09-02-tableaux-migration-design.md`](superpowers/specs/2026-09-02-tableaux-migration-design.md)
— incremental in-place TS migration (allowJs during transition, data
boundary converted first), real zod validation replacing `.passthrough()`,
no behavior changes bundled in, proceeds independently of subsystem B.
Ready for an implementation plan.

## Subsystem E — Brigade's expanded scope

**Decided:** Brigade keeps building on Cadence's published day, and grows
into four new areas, decomposed into their own sequence — each gets its own
dated spec when it's actually designed, the way the top-level seven
subsystems do:

| # | Feature | Depends on | Status |
|---|---|---|---|
| E1 | Vendor/contract management (deposits, payment dates, contact history) | — | ✅ **built** — [plan](superpowers/plans/2026-09-08-brigade-vendors-budget-tasks.md), 2026-09-08 |
| E2 | Budget tracking (per-vendor cost vs. overall budget) | E1 | ✅ **built** — [plan](superpowers/plans/2026-09-08-brigade-vendors-budget-tasks.md), 2026-09-08 |
| E3 | General task/checklist management (not tied to a Cadence block) | — | ✅ **built** — [plan](superpowers/plans/2026-09-08-brigade-vendors-budget-tasks.md), 2026-09-08 |
| E4 | Vendor-facing communication/portal (send job sheets, track confirmation) | E1, likely reuses the `/seat/[token]` share-link pattern rather than real vendor logins | ✅ **built** — [plan](superpowers/plans/2026-09-08-brigade-vendors-budget-tasks.md), 2026-09-08; shipped as supplier links with confirmation |

**Sequencing rationale:** E1 is foundational — both E2 (budget lines attach
to vendors) and E4 (you need a real vendor contact to send something to)
need vendors to exist as real entities first. E3 is independent of the
other three and could slot in anywhere, but doesn't block or get blocked by
them. E4 is last both because it depends on E1 and because it's the most
complex of the four — it likely needs some way for a vendor to receive/view
something without a full account, which points toward reusing the
`/seat/[token]` share-link pattern (subsystem B's territory) rather than
extending subsystem A's couple-only accounts to a third role.

**Still open:** each of E1-E4 needs its own full design pass (data model,
UI, testing) when its turn comes — none are speced yet.

## Subsystem F — Onboarding, billing & legal at product scale

**Decided:** always free, open source, no freemium — this was explicitly the
point of building it. No billing infrastructure, no paid tiers, ever.
Hosting: a maintainer-run hosted instance is the default experience for most
users, with self-hosting documented and supported as a real (secondary)
path — not just theoretically possible. License: AGPL, specifically so a
paid fork of the hosted service can't undercut the free-forever intent (the
root contract package is currently MIT — needs reconciling, see open
questions).

**Built.** [`2026-09-07-licensing-and-self-hosting.md`](superpowers/plans/2026-09-07-licensing-and-self-hosting.md)
executed in full on 2026-09-07 (branch `licensing-selfhosting`).

**Licence decision refined during implementation.** The spec said to relicense
every `package.json` including the root. The root package *is*
`@jfrusher/knotwork`, published to npm, and the founding design expects a
fifth app to depend on it — AGPL there would make it unadoptable while adding
nothing, since the stated aim (stopping a paid fork of the hosted service) is
served by AGPL on the application alone. **So: the application in `suite/` is
AGPL-3.0-or-later; the contract package stays MIT.**

`LICENSE` is now a notice naming both, because `npm pack --dry-run` shows npm
force-includes a root `LICENSE` in the tarball even when `files` omits it — an
AGPL `LICENSE` would have shipped inside a package declaring itself MIT.
Accepted cost: GitHub's licence detection shows "Other" rather than a badge.

Also found and fixed: `suite/.env.example` predated accounts and omitted
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so anyone
setting up from it got an instance where sign-in silently never worked.

**Still open:** the privacy/terms content rewrite, deliberately deferred by the
spec as a writing task. It should happen before real strangers' data is at
stake. Donations remain deferred until real usage exists.

**Spec:** [`2026-09-02-onboarding-billing-legal-design.md`](superpowers/specs/2026-09-02-onboarding-billing-legal-design.md)
— mechanical MIT→AGPL relicensing, self-hosting via a thorough markdown
runbook (no Docker), privacy/terms flagged for a real content rewrite
before real users' data is at stake, donations/sponsorship explicitly
deferred until real usage exists. Ready for an implementation plan.

## Subsystem G — Multi-tenant suite mechanics

Wedding switcher, per-tenant route/API isolation, rate limits, admin/support
tooling, account deletion/export (GDPR-style). Depends on A and B.

**Decided:** one active wedding per account for v1 — no wedding-switcher UI
yet. Kept additive-safe: multi-wedding-per-account can be layered on later
without a redesign, since it's a superset of the one-wedding case, not a
different shape.

**Built.** [`2026-09-07-multitenant-mechanics.md`](superpowers/plans/2026-09-07-multitenant-mechanics.md)
executed in full on 2026-09-07 (branch `multitenant-mechanics`). The write path
is rate limited per account, and `GET /api/documents/export` plus a button on
the account page give a couple their whole wedding as a file.

Two things the spec asserted turned out not to hold, and the plan records both:
the `/seat/[token]` limiter had **no** test coverage at all (added before making
it load-bearing), and the RLS negative test it asks for already existed at the
database layer, so the application-layer half was added instead of a duplicate.

**Spec:** [`2026-09-02-multitenant-mechanics-design.md`](superpowers/specs/2026-09-02-multitenant-mechanics-design.md)
— no built-in admin/support access to user data by design, reuse of the
existing in-memory rate limiter until real usage demands better, and data
export from day one (reusing the existing `bundle.mjs` pack format almost
directly). Self-hosting mostly sidesteps this subsystem entirely, since a
self-hosted instance is inherently single/few-tenant. Ready for an
implementation plan.

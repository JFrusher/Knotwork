# Roadmap

Where Knotwork is, and where it could go next. This page is the short
version for contributors. The full record of every decision, and why it was
made, is in **[docs/PRODUCT-ROADMAP.md](docs/PRODUCT-ROADMAP.md)** and the
dated specs in `docs/design/specs/`.

**How to read this:** ✅ is built and in the app. 🔜 is proposed, and a good
thing to pick up, but each proposal needs the maintainer's yes before code is
merged. Comment on the matching issue first. 💭 is further out and needs a
design pass before anyone builds it.

---

## ✅ V1: one wedding, every tool agreeing (shipped)

The core promise: a set of planning tools that share one document, so nothing
is retyped and nothing disagrees.

- ✅ **The shared document.** One owner per slice, unknown keys preserved, and
  a published MIT data contract (`@jfrusher/knotwork`).
- ✅ **Guests.** One guest list, one importer (Joy, Zola, The Knot, any CSV),
  with a preview before anything is written.
- ✅ **Seating.** A room drawn to scale, groups, families, keep-together and
  keep-apart rules, and a dietary breakdown. Now fully TypeScript.
- ✅ **Stationery** (once Place cards). Cards and table signs bound to the
  seating plan, with print checks.
- ✅ **Timeline.** Pinned and following blocks, squeezable blocks, collisions,
  curfew, travel between places, sunset and golden hour, and calendar files.
- ✅ **Delegation** and **Group shots.**
- ✅ **Checks between tools**, and the front page's "what is left".
- ✅ **The PDF pack.**
- ✅ **Works with no account.** Local-first, stored in IndexedDB.
- ✅ **Self-hosting runbook**, tested on a fresh clone.

## ✅ V1.1: planning together, and the toolbox (shipped)

- ✅ **Accounts.** No passwords: a six-digit code by email, or Google or Apple.
  Two partners per wedding, and signing in
  never silently replaces a wedding.
- ✅ **One live document**, with real-time sync, presence, one undo history,
  and version history with restore.
- ✅ **Planner mode.** A planner role, many weddings per account, and a
  library of reusable processionals, box sets and bar settings.
- ✅ **The toolbox.** Add or remove tools per wedding without losing work.
- ✅ **Ceremony cues.** The processional's music and order of service shown inside the ceremony block, read-only.
- ✅ **Ceremony, Boxes, Bar, Money, Checklist** and the **Binder**, which
  works offline on a phone.
- ✅ **Guest seat links** and **supplier links** with confirmation.
- ✅ **The order of service as a booklet.** Written in Ceremony, designed in
  Stationery — cover, repeated inside page, back, pictures, three starting
  styles — and printed folded at home or page by page for a print shop; on
  the guest link too, when the couple chooses.
- ✅ **Guided tour** with an example wedding, and the ⌘/Ctrl-K palette.
- ✅ **Download my wedding** as a single `.knotwork.json` file, and account
  deletion that really deletes.
- ✅ **Retention.** An account wedding nobody writes to for 24 months is
  deleted by a daily sweep, as the Privacy Policy states.

---

## 🔜 V1.5: tools feeding each other

Every tool already reads the shared document. These proposals connect the
newer tools to each other. Each one keeps the core rule: a tool writes only
its own slice and reads the others'. They are well scoped and the best place
for a first substantial contribution.

| From → To | What it does |
| --- | --- |
| ✅ **Boxes → Delegation** | Whoever is taking a box sees "Box 3 to the house by 09:00" on their job sheet. This is derived from the box, never stored as a job, so it follows the block if the day moves. |
| **Boxes → Binder** | Find a box or an item on the day: "where are the rings?" |
| **Ceremony → Binder** | The order of walking, on a phone, on the day. |
| **Bar → Timeline** | Reception, meal and evening hours read from the blocks the couple picks, rather than typed twice. |
| **Bar → Money** | The estimated drinks spend shown against the budget, as planned rather than paid. |
| **Bar → Checklist** | "Buy the drinks" and "Collect the ice", dated back from the day. |
| ✅ **Bar → Boxes** | Crates as boxes, attached to the bar's block. |
| ✅ **Timeline → Supplier links** | Each supplier's calendar file on their own call sheet. |

Source: [toolbox and new tools design](docs/design/specs/2026-09-29-toolbox-and-new-tools-design.md),
"Tools feeding each other".

---

## 💭 V2: beyond the couple and the desk

Explicitly deferred so far. Each needs a written design before code, because
each changes who can see what.

- 💭 **A Binder link for day-of helpers without an account.** It would carry
  phone numbers, so it needs its own look at what a link may reveal.
- 💭 **Agency teams.** More than one planner on a wedding.
- 💭 **Editing on phones.** Today phones get the read-only Binder, and the
  editing tools are desktop.
- 💭 **Public calculator pages.** For example, a standalone drinks calculator
  that people find through search.
- 💭 **A keyboard shortcut for the toolbox.**
- 💭 **More ways in.** Importers for other planners' exports, and tools
  nobody has thought of yet. Build one with
  [docs/BUILDING-A-TOOL.md](docs/BUILDING-A-TOOL.md).

---

## 🚫 Not planned, on purpose

So nobody spends a weekend on something that will be declined:

- **A paid tier, premium features or upsells.** This is the reason the
  project exists.
- **RSVP collection.** Joy and similar services do this well. Knotwork
  imports the result and never unseats or silently deletes a guest.
- **An admin panel or support login** that can browse weddings.
- **An official Docker image**, for now. The app is one Node process and an
  optional Supabase project. If a container would make your setup genuinely
  simpler, open a discussion and make the case.

---

## Picking something up

1. Find the item's issue, or open one naming the row above.
2. Say you are taking it, and sketch the approach in a few lines.
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) and, for anything that crosses
   tools, [docs/BUILDING-A-TOOL.md](docs/BUILDING-A-TOOL.md) section on
   connecting tools.

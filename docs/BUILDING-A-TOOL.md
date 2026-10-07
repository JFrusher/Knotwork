# Building a tool

Knotwork grows one tool at a time, and most of the good ideas come from
someone planning their own wedding and finding a job nothing did for them.
That is how the processional planner, Boxes and the Bar arrived. This guide
covers the whole journey, from "would this be a tool?" to a merged pull request
and what to do after it.

The three most recent tools were built exactly this way. Their plans are the
best worked examples, since they record what building each one actually
found:

- [Ceremony](design/plans/2026-09-29-cast-and-ceremony.md). It shares its
  people with Group shots, which moved them to a slice of their own.
- [Boxes](design/plans/2026-09-29-boxes.md). Each box is tied to a part
  of the day that another tool owns.
- [The Bar](design/plans/2026-09-29-bar.md). It is worked out live from
  the guest list, and its defaults were agreed before any code was written.

---

## 1. Is it a tool?

Before a line of code, the idea has to pass five questions, in order. Most
ideas stop at the first or second, and that is a good outcome: a feature in
the right place beats a tool in the wrong one.

**1. Does it exist already?** Look at the suite before designing anything. The
PRD that proposed the last four tools also proposed a "hard collision
checker". It turned out to exist already: Timeline flags the same supplier in
two places at once. It also proposed task assignment, which the Checklist
already did.

**2. Is it a feature of a tool that exists?** Ask whose data it mostly
changes. Travel time between two places is about the day's blocks and their
locations, which the Timeline owns. So it became a Timeline feature, not a
"logistics" tool. If your idea mostly edits another tool's data, it belongs
in that tool.

**3. Does it own something nothing else holds?** A tool is, underneath, a
slice of the wedding document that only it writes:

- what is packed in which box;
- who walks down the aisle, in what order;
- how much drink the couple chose to buy.

If the idea is a new way of *looking* at data that exists, it may be one of
these instead:

- a print (see [the wedding pack](#paper));
- a check (see [What is left](#what-is-left-checks-between-tools));
- a view inside an existing tool.

**4. Would many weddings use it?** Knotwork is for couples and the planners
who help them. An idea that fits one wedding's quirk is better as a note in an
existing tool. An idea a good share of couples would switch on is a tool.
New tools start switched off (see [the rules](#3-the-rules-every-tool-keeps)),
so a tool only some couples want is fine.

**5. Can it work with no network, no account and no tracking?** Tools never
touch the network. A test enforces it for the tools under
`suite/apps/` (`suite/apps/offline.test.ts`), and new tools keep the same
promise. Only the sync layer talks to a server, and it encrypts first. So the
couple types travel times rather than a map looking them up, and a tool never
phones home with anything.

Ideas that are **not wanted**, whatever their merit elsewhere:

- public calculator pages built for search traffic;
- anything that gathers data about guests beyond what the couple needs;
- a paid tier, or a feature held back for one.

The spec and the roadmap record why.

### Worked verdicts

| Idea | Verdict | Why |
|---|---|---|
| Travel time between venues | A Timeline feature | It is about blocks and their locations, which the Timeline owns |
| A collision checker | Exists | Timeline's double-booking check |
| Packing, "my shoes need to be at the house for 9" | A tool: Boxes | It owns what is in each box; where and when come from the Timeline |
| The processional | A tool: Ceremony | It owns the order of walking. Its people were Group shots', so the people moved to a shared `cast` slice |
| How much drink to buy | A tool: the Bar | It owns the couple's choices; the head count is read live from the guest list |

---

## 2. Propose it before you build it

Open an issue describing the job the tool does for a couple, in their words.
The one Boxes began from was "this box has my shoes in it and needs to be at
the house for 9". Then write two documents, both in `docs/design/`.

**A spec**, `specs/YYYY-MM-DD-<name>-design.md`. Read
[the toolbox spec](design/specs/2026-09-29-toolbox-and-new-tools-design.md)
first. Yours should cover:

- **Findings**: what already exists and what doesn't, each marked as
  *reproduced* (shown in a test, a build or a browser) or *traced* (read in
  the code, not run). A claim about the codebase with neither is a guess.
- **Decisions**: the questions the maintainer has to answer, with your
  recommendation for each. Record the answers in the spec.
- **The data**: the slice's shape, as a TypeScript interface.
- **Defaults**: any number a couple will trust without checking, such as drink
  rates or starter boxes. These are agreed with the maintainer before they are
  built, with sources. The Bar's defaults were agreed this way and are pinned
  in a test so a change is seen.
- **How it joins the other tools**: see [section 4](#4-connecting-to-the-other-tools).
  Each connection is a separate proposal the maintainer accepts or not.

**A plan**, `plans/YYYY-MM-DD-<name>.md`, once the spec is agreed. Write it as
checkbox tasks in small phases:

- *a*: the data, the page and the checks;
- *b*: paper;
- *c*: the planners' library.

End it with a **Status** section once built, saying what building it found
and where it differs from the spec. The next person reads that section first.

---

## 3. The rules every tool keeps

These are what make the tools feel like one wedding. Each exists because
breaking it once went wrong.

- **A tool writes only its own slice** and reads the others. The store copies
  every other key untouched, including keys from tools that do not exist yet.
- **Store only what the person chose.** Work everything else out each time.
  The Bar stores no head count: it reads the guest list on every render, so a
  guest saying no changes the wine. A box stores no time or place: it stores
  which block of the day it is for, and the Timeline says when and where. A
  copy of another tool's data is a second opinion that will go stale.
- **One history.** Every write goes through the wedding's store with a label,
  which is what the undo button says ("Undo packing"). A tool keeps no store
  or undo stack of its own. Two actions that could happen in quick succession
  need different labels, because same-labelled edits within 700ms fold into
  one step.
- **No network**, as above.
- **Nothing heavy on every page.** The page loads through `next/dynamic`, and
  PDF libraries are imported when someone presses Print, not before.
  `suite/apps/fontEngine.test.ts` names the import chain if the font engine
  reaches the shared layout again. It did once, and cost every page 144 KB.
- **Off until added.** Only the five core tools are on by default. A new tool
  waits in the toolbox. Removing it hides it and deletes nothing: adding it
  back shows its work as it was.
- **Nothing personal leaves a wedding** through the planners' library.
- **Accessible.** Every control has a label, headings go in order, and axe
  runs on every page in the end-to-end tests.
- **Plain British English.** Say "the couple" and use the partners' own names,
  never "bride" and "groom". Write "Nothing in it yet", not "No items found".
  Units are UK-first (75cl, 25ml, kilos), and every figure can be changed.

---

## 4. Connecting to the other tools

A tool on its own is a spreadsheet. The reason to build it here is what it can
know from the rest of the wedding.

**Read, don't copy.** The readers in `suite/lib/model/slices.ts` return each
slice in a checked shape and are cached per document:

- `readGuests`
- `readCrew`
- `readTimeline`
- `readCast`
- `resolvedDay`

The day's blocks with their worked-out start and end times come from
`dayPlaces`, beside them. Name crew members with `personName`, which prefers the
guest list's spelling when the person is a guest.

**Shared people.** The couple, their parents, grandparents and wedding
parties are the `cast` slice, shared by Group shots and Ceremony. Pick people
with `components/cast/MemberPicker` and turn them into names with
`resolveMembers` in `lib/cast/resolve.ts`. Don't start a second list of roles.

**When two tools need to edit the same thing**, it becomes a slice of its own,
owned by neither. That is what happened to the cast: it lived inside `shots`
until Ceremony needed to edit it too. It was moved when a wedding loads, and
read from either place until then.

**Pointing at another tool's record by id** means handling it disappearing. A
box points at a block of the day. If someone deletes the block, the box is
"lost": the page marks it, and What is left says so. Never assume the record
is still there.

**What is left** is the list on the front page. It carries only the problems
*between* tools, plus dated nudges ("things still to pack, and the day is in 3
days"). A problem your tool can see for itself, it shows on its own page. See
[below](#what-is-left-checks-between-tools) for where it goes.

**Tools feeding each other.** Ideas like "the Bar's hours read from the
Timeline" or "a box shows on its carrier's job sheet" go into the spec's
*Tools feeding each other* table as proposals. Each is accepted or declined on
its own. Build only the accepted ones.

---

## 5. Building it, step by step

Every file a new tool touches, in the order that keeps the build green. The
Bar is the example throughout. Its id is `bar`, and its pieces are in
`suite/lib/bar/`, `suite/components/bar/` and `suite/app/(app)/bar/`.

### The data

1. **The contract** (`src/`, published as `@jfrusher/knotwork`):
   - add `barSchema = z.looseObject({}).default(() => ({}))` to `src/slices.ts`;
   - add `"bar"` to `SLICE_NAMES` and `knotworkSchema` in `src/envelope.ts`;
   - export it from `src/index.ts`;
   - update the list in `src/envelope.test.ts`.

   This step is not optional. A top-level key the contract does not list is
   merged local-over-server, so a partner's edit to it is silently lost on
   the next sync. Run `npm run build` at the root afterwards, because the
   suite reads the built package.

2. **The shape** in `suite/lib/model/types.ts`: the interface, and any fixed
   lists as `const` arrays for the reader to check against.

3. **The reader** in `suite/lib/model/slices.ts`: `readBar(doc)` and
   `emptyBar()`.
   - Check every field coming in, since a stored document can be anything:
     hand-edited, older, or written by a newer build.
   - Wrap the reader in `cached(doc, "bar", …)`. A reader that returns a new
     object each time loops React forever inside a store selector.
   - Add it to `suite/lib/model/selectors.test.ts`, which proves the reading
     is stable.

4. **The hook and the writer** in `suite/lib/model/useSuite.ts`: add `useBar`,
   and `setBar` with a default label.

5. **How it merges** when two people edit at once:
   - A slice is merged as one piece by default.
   - If two people will commonly change *different records* of it at the same
     time, such as two people packing different boxes, add it to `KEYED` in
     `suite/lib/documents/parts.ts` so it merges record by record.
   - Either way, name it in words in `WHOLE` (and `COLLECTION`, if keyed) in
     `suite/lib/documents/describe.ts`. Those names are what Sync & history
     shows.

6. **Whether a wedding holds any of it**: add a count to
   `suite/lib/model/content.ts`. That count is what decides whether a
   wedding has anything someone would be sorry to lose. Count what somebody
   entered, never whether the slice exists.

7. **If the shape ever changes after release**, convert it quietly when a
   wedding loads, in `reconcileLoadedDocument` in
   `suite/lib/seating/normalise.ts`. Until then, read both shapes: the
   server reads stored documents nobody has opened since.

### The logic

Keep it pure and beside its tests:

- `lib/<tool>/actions.ts`: each change takes the slice and returns a new one;
- `lib/<tool>/view.ts` or `sum.ts`: whatever is worked out from it;
- `lib/<tool>/defaults.ts`: every default, in one table.

Pure functions are what make the rules above testable. `lib/bar/sum.test.ts`
pins the agreed defaults for 100 guests, so anyone changing a default sees
exactly what it does to the shopping list.

### The page

1. **Register it** in `suite/lib/tools.ts`:

   | Field | What goes in it |
   |---|---|
   | `id` | Stored in weddings, so never renamed |
   | `href` | Always `/${id}` |
   | `tokens` | One of the five palettes in `lib/design/tokens.css` |
   | `name` | The tab's name |
   | `tagline` | One line on what it is for |
   | `icon` | A `lucide-react` icon |
   | `defaultOn` | `false` |

   The header, the toolbox, the palette and the live presence list all read
   this registry, so they need nothing more.

2. **The route**: `suite/app/(app)/<id>/page.tsx`, a server component
   holding the page's `metadata` and a screen-reader `<h1>`, and
   `<Name>Client.tsx`, which loads the board with
   `next/dynamic(..., { ssr: false })`. Copy Boxes' pair. A tool that only
   works on a wide screen goes under `(tools)/` instead, which wraps it in the
   landscape gate (and supplies the `<h1>`), and has `wide: true`.

3. **The board**, `suite/components/<tool>/<Name>Board.tsx`:
   - Render nothing until `useStatus()` is `"ready"`, because the store
     refuses writes before the wedding has loaded.
   - Put `<ToolUndo />` in it.
   - Build from `components/ui/controls` and `components/ui/NumberInput`.
   - Put a `data-tour` attribute on its main area.

### Across the wedding

- **The front page**: an area in `suite/lib/model/overview.ts`, with a
  one-line summary and a detail line. The summary starts with "No" when there
  is nothing yet, and there's a progress measure if one means something.
  Give the area your tool's id, and it disappears with the tool when a
  wedding hides it.
- <a id="what-is-left-checks-between-tools"></a>**What is left**: a check in
  `suite/lib/model/readiness.ts`, with an `id`, a severity (`blocking` or
  `advisory`), a message, an action, and `href` pointing to your page. Add
  your page to the `href` type. A tool the wedding hides has its checks
  hidden too, matched by `href`, which is why a tool's address is its id.
- **The tour** is held to under thirty steps and has twenty-nine, so a new
  tool usually gets no chapter. Leave the `data-tour` anchor so one can point
  at it later. Chapters are keyed by tool id and skipped when the tool is
  hidden.

### Paper

- **One set of rows for everything printed.** Write one function that turns
  the slice into rows. The page, the PDF and the CSV all use it, so they
  can't disagree. See `lib/bar/rows.ts` and `lib/boxes/rows.ts`.
- **PDFs** use the shared page, text and font kit in
  `suite/lib/pdf/`, as the shot sheet, the processional,
  the box labels and the shopping list do. Test them in Node with
  `nodeFontSource` and `textOf`, which reads the words back out of the PDF.
  **CSV** goes through `toCsv` in `lib/data/csv.ts`.
- **The wedding pack**: add a section to
  `suite/components/shell/WeddingPack.tsx` that returns `null` when there is
  nothing to print. If your tool's output exists even for a wedding that
  never used it, as the Bar's does for any wedding with guests, return `null`
  unless `hiddenToolIds(doc)` shows the tool. Otherwise every pack gains a
  page nobody asked for.

### The planners' library

Planners reuse work across weddings. To let them keep your tool's work:

1. **In `suite/lib/library/items.ts`**, add the kind to `KINDS` and
   `KIND_NAMES`, then write `extract` and `applyTo`:
   - **`extract`** is built from a whitelist of what to keep, never by
     removing what not to. A field added later then stays out until someone
     decides it belongs. Keep nothing personal: no guest, no head count, no
     date.
   - **`applyTo`** either **replaces** the wedding's own, or **adds** what it
     lacks. If it adds, list the kind in `ADDING`.
2. **In `components/library/LibraryPage.tsx`**, say in words what the kind
   carries (`CARRIES`) and, if it replaces, what it replaces (`REPLACES`).
3. **The database** checks the kinds too. Add a migration,
   `supabase/migrations/<timestamp>_library_<kind>.sql`, that widens the
   `library_items_kind_check` constraint. Copy
   `20260929000006_library_bar.sql`, which can safely run twice.
   `lib/library/migrations.test.ts` runs every migration against PGlite; add
   your kind to the test there.

### The example wedding

`suite/public/fixtures/example-wedding.knotwork.json` is what the tour and
the tests load, and it shows every tool. A test enforces that. Add your id to
`tools.shown` and give it believable data.

Write the file back as it is formatted: two-space JSON, non-ASCII characters
kept as they are, and a trailing newline. In Python that is
`json.dumps(d, indent=2, ensure_ascii=False) + "\n"`.

### Tests

**Unit tests** go beside the code. Cover:

- the actions;
- the sums;
- the reader's checking;
- the rows and the PDF text;
- the library kind.

**Lists that name every tool** need your tool added:

- `lib/model/toolbox.test.ts`, the hidden tools;
- `lib/palette/search.test.ts`;
- `e2e/palette.spec.ts`, the option count;
- `e2e/tools.spec.ts`, the stored list;
- `e2e/a11y.spec.ts`, the `PAGES` list for axe.

**An end-to-end spec**, `suite/e2e/<id>.spec.ts`, should cover:

- the example wedding's data showing correctly (`seedExampleWedding`);
- an edit being stored and undone (`storedDocument` reads what was written);
- a new wedding adding the tool from Tools and using it from empty;
- each print downloading.

**The gate** is what CI runs. Run all of it before opening the pull request:

```bash
npm run build && npm run typecheck && npm test          # the contract
npm run typecheck -w suite && npm run test -w suite     # the suite
npm run build -w suite && npm run e2e -w suite          # the browser tests
```

---

## 6. Before you open the pull request

- [ ] The idea passed [section 1](#1-is-it-a-tool). The spec and plan are
      agreed, including any defaults.
- [ ] The slice is in the contract's `SLICE_NAMES`, and the root package is
      rebuilt.
- [ ] The tool writes only its own slice and stores only what people chose.
- [ ] Every write is labelled. Undo takes back one thing at a time.
- [ ] There is no network code, and nothing heavy is imported until it's
      needed.
- [ ] It is registered off by default. Hiding it hides its area, its checks
      and its pack section.
- [ ] Records it points at in other tools can disappear safely.
- [ ] The example wedding shows it.
- [ ] The library kind keeps nothing personal, and its migration is written
      and tested.
- [ ] The full gate passes, axe included.
- [ ] The plan's Status section says what building it found.

In the pull request, **name every migration at the top**, in the order they
must be applied, since the maintainer applies them by hand.

## 7. After it merges

- The migrations are applied **before** the code deploys. A deploy that lands
  first fails writes that need them.
- Mark the phase built in the spec and on
  [the roadmap](PRODUCT-ROADMAP.md).
- The proposals in the spec's *Tools feeding each other* table wait for the
  maintainer. Each one that's accepted becomes a small plan of its own.

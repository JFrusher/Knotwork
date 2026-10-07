# Public calculator pages

Issue #82. Decided with the maintainer on 2026-10-07. The drinks calculator (#83) is built to this spec.

## Routes and sitemap

- Calculators live under `/calculators/<name>`, outside the app's route group, as the blog is. The first is `/calculators/drinks`.
- Each is in `app/sitemap.ts`. The tools stay out of it.
- Each links to the guide that explains its numbers.

## Nothing written, nothing sent

- A calculator holds its figures in React state on that page. It never loads the wedding store, so nothing reaches IndexedDB, and it makes no request. The e2e test checks that the page leaves no IndexedDB database.
- No analytics beyond the existing cookieless route counts.

## The sums are the tool's own

- A calculator renders the tool's own sheet with no wedding behind it. For drinks that is `BarSheet` from `components/bar/BarBoard.tsx`, with `doc` null: the head count is typed, and the hours are never read from a Timeline.
- `lib/bar/calculator.ts` is the whole difference: a starting bar of 100 coming, and `sumBar` with that typed count. A unit test gives the example wedding's guests and the same settings to the Bar and the calculator and gets the same lines.

## The bridge

- **Wanted.** "Use these figures in your own wedding's Bar" goes to `/bar#from-calculator=<settings>`.
- The Bar reads the settings through the library's `extract("bar")`, so only what the Bar knows survives. It **asks** before applying them through `applyTo("bar")`, the same replace a kept library Bar does: the wedding keeps its head count, evening guests, any hours the Bar reads from its Timeline and what it already has, and Undo takes it back. An untouched calculator carries the defaults, so using it puts them back. That keeps the rule that a wedding is never replaced silently.
- The address is cleared once it has been read, so a reload does not ask twice.

## What comes after drinks

Candidates, each its own issue when wanted:

- **Seating capacity for a room:** tables of a given size and shape in a room of given measurements. It needs a pure function of Seating's spacing rules first; today they live in the canvas.
- **Timeline length:** how long a day runs from a ceremony time and the usual blocks. It needs Timeline's defaults as a pure list.

Neither is built here.

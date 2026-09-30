# Hacker News: Show HN

**Post from:** the maintainer's own account.
**When:** Tuesday to Thursday, 8–10am US Eastern.
**Link to:** `https://github.com/JFrusher/Trousseau`. The hosted app needs no
sign-up, so it satisfies Show HN's "something people can try" rule. Put the
app link in the first line of the text.
**Stay:** in the thread for at least three hours, and answer every technical
question.

Show HN guidelines: the title starts with "Show HN:". No superlatives, no
marketing language, and no asking for upvotes. The ask below is for feedback
and code review, which HN welcomes. Leave stars to the README.

---

## Title variants

Pick one. Each is under 80 characters.

1. `Show HN: Trousseau – open-source wedding planner where the tools share one document`
2. `Show HN: I built an open-source, self-hostable wedding planner`
3. `Show HN: A local-first wedding planner – seating, place cards, run sheet, one file`
4. `Show HN: Trousseau – free wedding planning tools that don't disagree with each other`

**Recommended: 1.** It names the idea that is actually new, and "one document"
is what an HN reader will want to argue about.

---

## Body

> Try it (no sign-up, nothing leaves your browser): https://trousseau-suite.vercel.app
> Code: https://github.com/JFrusher/Trousseau
>
> I built Trousseau for my own wedding, after two of the apps we were using
> disagreed about what day it was.
>
> Every wedding planning tool I tried was a set of separate pages sharing a
> login. The seating chart, the place cards and the run sheet each held their
> own copy of the guest list, and the copies drifted. The "free" apps are paid
> for by vendor marketplaces, registry commissions and upsells. Their product
> is a spreadsheet of your guests' names, emails, family relationships and,
> via dietary requirements, sometimes medical details.
>
> So Trousseau is one JSON document per wedding, with eleven tools around it:
> seating (a room drawn to scale), place cards, a timeline, job delegation,
> group photos, ceremony, packing boxes, a bar calculator, money, a checklist
> and a phone "binder" for the day. Each tool owns one slice of the document
> and reads everyone else's. Seat someone and their place card already knows
> the table. Pin the ceremony, let the rest of the day follow it, and moving
> the ceremony ten minutes moves every job hanging off it.
>
> Some technical bits people here might find interesting:
>
> **The merge rule.** A tool rewrites only its own slice and copies every
> other key byte for byte, including keys from tools that don't exist yet.
> The merge runs on raw stored data, not the parsed document. A bug in a zod
> schema should at worst refuse a read, never destroy a write. That is also
> how a new tool ships without a new version of the others.
>
> **The timeline resolver.** It is one pure function that the screen and
> every PDF read. Blocks are either pinned to a clock time or follow their
> predecessor plus a gap. A lane is walked in stretches between pinned
> blocks. If a chain overruns the next pinned time, the overrun comes out of
> blocks marked squeezable (each has a minimum). Anything left over is
> reported as a collision rather than silently moved. The resolved times go
> into a separate `day` slice, so Delegation never runs a scheduler of its
> own. Sunset and golden hour use the NOAA solar equations offline. There is
> no timezone database: the UTC offset is typed in, because a planner knows
> whether it is BST and tzdata costs 300 kB.
>
> **Checks between tools.** Each tool validates its own slice, but the bugs
> worth catching live between them: two slices claiming different dates, a
> table over capacity, a seat holding two people, and confirmed guests with
> no table. The same validator is a hard gate on the server's write path.
>
> **Storage.** It is local-first: IndexedDB, no account needed. Accounts use
> Supabase: Postgres JSONB with one document per wedding, row-level security,
> compare-and-set writes, real-time sync, and bounded version history.
> Conflicts are shown to the user, never silently resolved.
>
> **Privacy.** Encrypted at rest, not end to end, and the README and privacy
> policy say so plainly. There is no admin panel. A guest's seat link serves
> only ciphertext, with the key after the `#`. Self-hosted off Vercel, it
> sends no analytics at all.
>
> **Stack:** Next.js 16, React 19, TypeScript, Zustand, zod 4, Tailwind 4,
> Supabase, pdf-lib and jsPDF for print. Vitest has 1,800+ cases, including
> RLS policies tested against PGlite. Playwright with axe runs against the
> production build.
>
> **On Claude Code:** about half the commits are co-authored with it, and
> I'd rather be upfront about how. Every subsystem got a dated spec and then
> a plan in `docs/superpowers/`, which I approved before anything was built.
> The plans record where building them found the plan was wrong. That
> record turned out to be the most valuable part. Two examples:
>
> - A test that was meant to keep the privacy policy honest checked the
>   policy's own wording, not the layout. So when analytics were added to the
>   layout, nothing noticed. The test now reads the layout.
> - Renaming a field on a loose zod object (`looseObject`) left `tsc`
>   completely silent, because the inferred type has an index signature.
>   That one needed a guard asserting against the schema's shape.
>
> The pattern I'd pass on: make the agent write down what it expects, then
> what it found. The diff between the two is where the bugs are.
>
> Licensing: the app is AGPL-3.0, so nobody can run a closed paid fork of
> the hosted service. The data contract is an MIT npm package
> (`@jfrusher/trousseau`), so anyone can build a tool that reads the file.
> There is no paid tier and there won't be one.
>
> What I'd really like from HN:
>
> - Criticism of the one-document, slice-per-tool design. Where does it break?
> - A review of the RLS and `security definer` setup in `supabase/migrations/`.
> - Self-hosters: is "Next.js + optional Supabase, no Docker" a dealbreaker,
>   or fine?
> - If you're planning a wedding, or helped someone plan one, what job did
>   no tool do for you?
>
> Happy to answer anything.

---

## Prepared answers for likely comments

**"Why not Docker?"**
> Deliberate so far. Local-only is `npm ci && npm run build && npm run dev -w
> suite`, and there is no backend at all. Sync needs Supabase, which has its
> own self-hosting story. A Dockerfile would be a second thing to keep working.
> If people here would actually use one, I'm open to it. Tell me what it would
> make easier.

**"Why not CRDTs / Automerge / Yjs?"**
> Two or three editors per wedding, who mostly edit different slices. So
> compare-and-set per document, plus a merge that works slice by slice in the
> browser, covered it. A true conflict is shown to the user, because
> "someone else changed this table" is a question for a human. If the planner
> side grows to agency teams, I'd revisit it.

**"Why not normalised tables?"**
> I considered a row per slice and rejected it: one compare-and-set would
> become up to sixteen. The cross-slice check that refuses a wedding with two
> dates would need a transaction around them. And the live channel would
> announce several versions per change. The database review in
> `docs/superpowers/specs/` has the reasoning.

**"How do you make money?"**
> I don't, and that's the point. Hosting a wedding's JSON is cheap. If usage
> grows there's a Ko-fi; there will never be a paid tier.

**"Is it really private if you host it?"**
> Encrypted at rest with RLS, no admin panel, and no support login. But I
> administer the database, and the privacy policy says so plainly. If that's
> not enough, and for some people it shouldn't be, use it with no account at
> all, or self-host it.

**"Does it do RSVPs?"**
> No, on purpose. Joy and others do that well. Trousseau imports your RSVPs
> from their CSV exports and flags confirmed guests with no table.

**"Did the AI write it all?"**
> About half the commits are co-authored. The design decisions, the specs,
> and which trade-offs to take are mine and written down. The approved spec
> and plan for every subsystem are in the repo, so you can judge for
> yourself.

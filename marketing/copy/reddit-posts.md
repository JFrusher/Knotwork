# Reddit posts

Three posts, one per community, each written for how that community talks.
Space them at least a day apart.

**Before posting any of them:**

- Read the subreddit's sidebar and pinned rules **on the day**. Self-promotion
  rules change, and some subs only allow projects on certain days or with a
  specific flair.
- Post from the maintainer's own account and reply to comments for the first
  few hours.
- Screenshots use the guided tour's example wedding. Never a real guest list.
- The personal details (your own wedding, what you found hard) are yours to
  tell. Edit anything here that isn't exactly how it happened. On Reddit, one
  detail that turns out to be embellished undoes the whole post.

---

## 1. r/selfhosted

**Title:**
`Trousseau: a local-first, self-hostable wedding planner (seating, place cards, run sheet), AGPL, no analytics when self-hosted`

**Flair:** use whatever the sub currently requires for a project you made.

**Body:**

> My partner and I planned our wedding with a handful of apps. Two of them
> ended up disagreeing about the date, and all of them wanted our guest list:
> names, emails, family relationships, and dietary requirements, some of
> which are really medical information. So I built my own, and I've kept
> building it for other couples.
>
> **What it is:** a planning suite where every tool shares one JSON document.
> Seat people in the floor plan and one click puts every table number on the
> place cards. Move the ceremony and every job and block after it moves too. There
> are eleven tools: seating to scale, place cards, timeline, delegation,
> group photos, ceremony, boxes, bar, money, checklist, and a phone binder
> that works offline.
>
> **The self-hosting bits you'll care about:**
>
> - **Local-first.** With no account, the whole wedding lives in the
>   browser's IndexedDB and nothing leaves the device. This works the same on
>   the hosted site and on your own copy.
> - **No analytics on your instance.** The page counter only renders when
>   running on Vercel, and Sentry only initialises if you set a DSN. Leave
>   both alone and it phones home to nothing.
> - **Your domain, your database.** Accounts, sync between devices, and
>   partner and planner access need a Supabase project, either their cloud
>   free tier or self-hosted Supabase. Apply the migrations in order and the
>   row-level security does the tenant isolation.
> - **Export everything** as one `.trousseau.json` file. The schema is a
>   published MIT npm package, so you can script against it.
> - **AGPL-3.0**, so nobody can take the hosted version closed.
>
> **Setup, local-only:**
>
> ```
> git clone https://github.com/JFrusher/Trousseau.git
> cd Trousseau
> npm ci
> npm run build
> npm run dev -w suite
> ```
>
> **About Docker, before you ask:** there is no image yet. That was a
> deliberate choice: it's one Next.js process plus an optional Supabase
> project, and I didn't want a second thing to maintain. But this is exactly
> the crowd to tell me if that's wrong. Would you actually run it from a
> compose file? What would you want in it: just the app, or the app plus
> Supabase?
>
> The self-hosting guide was written by running every command on a fresh
> clone. It lists every env var, the migration order, and the two mistakes
> that catch everyone out. It also ends with a section on checking that the
> instance actually works, not just that it starts:
> https://github.com/JFrusher/Trousseau/blob/main/docs/SELF-HOSTING.md
>
> Repo: https://github.com/JFrusher/Trousseau
> Hosted, if you just want to click around (no sign-up): https://trousseau-suite.vercel.app
>
> Happy to answer anything about the architecture or the RLS setup.

**Replies to have ready:**

- *"Why Supabase and not plain Postgres?"* Auth by magic link, row-level
  security and the realtime channel all come from it. The data is plain
  Postgres JSONB, and the migrations are plain SQL.
- *"Can I run it without Supabase at all?"* Yes. Everything but accounts,
  sync and share links works with no backend. Set nothing, and the account
  routes answer 501 and say accounts aren't set up on this deployment.
- *"Is the data E2E encrypted?"* No. It's encrypted at rest with RLS, and the
  privacy policy says so. On your own instance, you are the operator.

---

## 2. r/WeddingsUnder10k

**Title:**
`I made a free wedding planner with no ads or upsells: seating chart, place cards that fill in table numbers, and a day-of timeline`

**Body:**

> Hi all! We got married recently. The planning apps we
> tried were "free" in the way that means you're shown vendor ads, nudged
> towards paid stationery, and asked for everyone's email addresses. So I
> built my own set of tools, and now I've made it free for anyone.
>
> It's called **Trousseau**. It's genuinely free: no premium version, no
> trial, no ads, and nothing to upgrade to later. It's open source, so that
> can't quietly change.
>
> **What it does:**
>
> - 🪑 **Seating chart drawn to scale.** Draw your actual room, drag tables
>   in, drag guests onto seats. It keeps a running count of dietary needs as
>   you go, and you can say "keep these two apart" and it'll warn you.
> - 💌 **Place cards you print at home.** Once people are seated, the cards
>   fill in their own table numbers. Use your own design, print on your own
>   card stock, and skip paying per card. It even refuses to print a card with
>   a missing name or font, so you don't waste good card.
> - 🕒 **Day-of timeline.** Pin the ceremony time and let everything else
>   follow. If the ceremony moves, the whole day moves with it. It warns you
>   when things overlap or run past the venue's curfew, and it knows when
>   golden hour is for photos.
> - 📋 **Who's doing what.** Hand out jobs to your helpers (setting up
>   chairs, bringing the cake stand) and print a sheet for each of them.
> - 💷 **Money.** What each supplier costs, what's paid, and what's due when,
>   against your budget.
> - 🍷 **Bar calculator.** How many bottles and cases to buy for your guest
>   count, if you're doing your own drinks. (It's UK-built, so it thinks in
>   UK units, but the bottle counts work anywhere.)
> - 📱 **Day-of binder on your phone** that works without signal, because
>   venues never have signal.
>
> **The privacy bit:** you don't need an account. It saves in your browser,
> and your guest list never leaves your computer. If you want to plan with
> your partner on two devices, you can make an account, but there's no
> password, and no one (including me) browses weddings.
>
> **Already have your guest list somewhere?** Export it from Joy, Zola or The
> Knot, or from your spreadsheet, and import the CSV. It works out which
> column is which and shows you a preview first.
>
> There's a guided tour with a pretend wedding if you just want to poke
> around: https://trousseau-suite.vercel.app
>
> It doesn't do RSVPs or a wedding website. Joy is great for that and free,
> and Trousseau imports the RSVPs from it.
>
> I'd love to know what's missing, what's confusing, or what job you're still
> doing in a spreadsheet. That's how every tool in it so far got built.

**Replies to have ready:**

- *"Is it really free? What's the catch?"* No catch. It costs me very little
  to host, there's a Ko-fi if people want to chip in, and the licence means
  it can't become a paid product later.
- *"Does it work on a phone?"* The Binder is made for phones on the day.
  Planning (drawing the room, designing cards) is a laptop job.
- *"Can my planner use it?"* Yes. A wedding can have two partners and one
  planner, and planners can hold many weddings.

---

## 3. r/opensource (or r/webdev)

**Title (r/opensource):**
`Trousseau: an AGPL wedding planner built around one shared document. Looking for contributors, and there's a guide to adding a whole tool`

**Title (r/webdev):**
`I built a wedding planner as 11 tools sharing one JSON document: architecture notes and lessons (Next.js 16, Supabase, zod)`

**Body (works for both; trim the last section for r/webdev if its rules
discourage recruiting):**

> Trousseau started as four separate apps I wrote for my own wedding: seating,
> place cards, a run-of-day timeline, and a jobs list. They each kept their own
> copy of the guest list, and one day two of them disagreed about the wedding
> date. The fix became the architecture.
>
> **One document, one owner per slice.** The wedding is one JSON document.
> Each tool rewrites only its own slice and copies every other key
> byte-for-byte, including keys belonging to tools that don't exist yet. The
> merge runs on raw stored data, not the parsed result, so a schema bug can
> refuse a read but never corrupt a write. Tools communicate only by reading
> each other's slices: the timeline publishes resolved clock times into a
> `day` slice, and delegation reads those instead of running its own
> scheduler.
>
> **Cross-slice validation.** Each tool validates itself. A separate checker
> looks only at what no single tool can see, like two slices claiming
> different dates or a guest seated at a table that doesn't list them. The
> same checker gates writes on the server.
>
> **What's in the repo:**
>
> - Next.js 16 (App Router), React 19, TypeScript, Zustand, zod 4,
>   Tailwind 4
> - Supabase: Postgres JSONB, RLS, magic-link auth, realtime, bounded history
> - An MIT npm package (`@jfrusher/trousseau`) holding the schemas and file
>   format, separate from the AGPL app, so third-party tools can read the
>   file
> - 1,800+ Vitest cases, RLS tested against PGlite, and Playwright with axe
>   against the production build
> - Dated design specs and implementation plans for every subsystem in
>   `docs/superpowers/`, written before code, including where the plan turned
>   out to be wrong
>
> **Lessons that might save you time:**
>
> 1. A zod `looseObject` gives an inferred type with an index signature, so
>    renaming a field compiles silently. Assert against `schema.shape` at the
>    boundary.
> 2. If a test is meant to keep your privacy policy honest, make it read the
>    code that collects data, not the policy's own wording. Ours checked the
>    wording, and analytics were added without it noticing.
> 3. Supabase's Security Advisor warns about `security definer` functions.
>    On a function that RLS policies call, its suggested fixes can lock every
>    user out of their own data, or recurse until the stack overflows. We met
>    both.
> 4. `npm pack` includes a root `LICENSE` even when `files` omits it. An
>    AGPL `LICENSE` would have shipped inside an MIT package.
>
> **Contributing.** There's a list of well-scoped "tools feeding each other"
> proposals in the roadmap. For example, packing boxes showing up on
> whoever's carrying them, or the bar's estimated spend appearing in the
> budget. There's also a guide to building an entirely new tool, from "is
> this a tool?" to merged PR.
>
> - Repo: https://github.com/JFrusher/Trousseau
> - Roadmap: https://github.com/JFrusher/Trousseau/blob/main/ROADMAP.md
> - Try it (no sign-up): https://trousseau-suite.vercel.app
>
> Critique of the design is as welcome as PRs.

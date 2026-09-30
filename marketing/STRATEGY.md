# Trousseau — growth strategy

The plan for getting Trousseau in front of the people it is for. Every claim in
this folder was checked against the code before it was written. The last
section lists the claims that were **left out** because the code does not back
them. Read it before editing any of the copy.

---

## One-line positioning

> **Trousseau is a free, open-source wedding planner where every tool shares
> one wedding: seat your guests and one click puts every table number on the
> place cards; move the ceremony and the whole day moves with it.**

## Unique selling proposition

**100% free, private, self-hostable and modular. No ads, no upsells, no data
sales, and no paid tier, ever.**

Each part of that is backed by the repository:

| Claim | Evidence |
| --- | --- |
| Free forever, no paid tier | `docs/PRODUCT-ROADMAP.md`: "no paywalled tiers, no upsells on someone's wedding … it rules out billing infrastructure as a subsystem entirely." The AGPL on `suite/` is there to stop a paid closed fork. |
| Private | With no account, the wedding lives in the browser's IndexedDB and nothing leaves the device. There is no admin panel or support login. Guest data never goes to a third party (roadmap decision, 2026-09-28). |
| Self-hostable | `docs/SELF-HOSTING.md` is a tested runbook. Local-only needs no backend at all. Accounts and sync need a Supabase project. |
| Modular | `suite/lib/tools.ts`: five tools are on by default and six more can be added from the toolbox. Removing a tool hides it without deleting its work. |
| No tracking when self-hosted | Page counting renders only when `onVercel()` (`suite/app/layout.tsx`), and Sentry only with a DSN set. A self-hosted instance off Vercel sends nothing. |
| Your data, portable | *Download my wedding* exports the whole thing as one `.trousseau.json` file, the same format the app uses. The schema is an MIT-licensed npm package (`@jfrusher/trousseau`). |

## The idea that makes it different

Most wedding apps are a set of separate pages that happen to share a login.
Trousseau is **one document with one owner per slice**. Each tool rewrites
only its own part of the wedding and reads everyone else's. This is the
mechanism behind every demo worth showing:

- **Seating → Place cards.** Seat someone, press *Use the room*, and every
  card already has its table number.
- **Timeline → Delegation.** Pin the ceremony and let the rest of the day
  follow it. Move the ceremony by ten minutes and every job hanging off it
  moves too.
- **Seating → Timeline.** A block's Location offers the spaces drawn on the
  floor plan, so "Orangery" means the same room in both.
- **Checks between tools.** It flags two dates for one wedding, one seat
  holding two people, a table over capacity, and confirmed guests with no
  table or no dietary answer.

Lead with this. "Free wedding planner" is a crowded phrase. "The tools
agree with each other" is not.

---

## Core features (from the code)

Extracted from `suite/lib/tools.ts`, the app routes and the tool modules.

**Always on**

- 👥 **Guests.** The one guest list every tool builds on. It has a CSV import
  with a column mapper that guesses fields (name, email, RSVP status,
  dietary, main course, side, notes) and shows a preview before anything is
  written. Exports from Joy, Zola, The Knot or a spreadsheet all import.
  (`suite/lib/data/guestImport.ts`)

**On by default**

- 🪑 **Seating.** Draw the room to scale in real units. Drag tables and
  guests, with alignment snapping. Groups, families, and "keep together /
  keep apart" rules. A live dietary breakdown. A printable floor plan.
- 💌 **Place cards.** Print-ready cards and table signs. Bind
  `{{First Name}}`, `{{Table}}` and other fields onto your own artwork.
  Export refuses to print a missing font or an empty monogram.
- 🕒 **Timeline.** Lanes for the day, suppliers and transport. Blocks are
  either pinned to a clock time or follow what comes before. A
  scheduling resolver squeezes flexible blocks to make a fixed time. It
  flags collisions and curfew overruns, and checks travel time between
  places. Sunset and golden hour are computed offline. Calendar files.
- 📋 **Delegation.** Jobs hung off each block of the day, and who is doing
  them. People are picked from the guest list, not retyped.
- 📷 **Group shots.** The family photo list, built from who is related to
  whom.

**Added from the toolbox**

- 💍 **Ceremony.** The processional, the order of service, music and
  readings, and cues shown on the Timeline.
- 📦 **Boxes.** What is packed in which box, and where each box has to be by
  when. Labels, a packing list and a spreadsheet.
- 🍷 **Bar.** How much drink to buy, in bottles and cases (UK units), what it
  roughly costs, and a shopping list.
- 💷 **Money.** Supplier costs against your budget, what is paid, and what
  falls due.
- ✅ **Checklist.** What to have done before the day, each item with a date.
- 📱 **Binder.** The day on your phone, read-only: what is on now and next,
  who to ring, where a guest sits. Works without signal.

**Around the tools**

- 🖨️ **The pack.** One PDF with the floor plan, run sheet, job list and group
  shots.
- 🔗 **Guest seat links.** One guest sees their own seat and nothing else.
  **Supplier links** let a supplier see and confirm their part.
- 🤝 **Two partners and a planner.** Magic-link sign-in with no passwords.
  Real-time sync and presence. Conflicts are shown, never silently resolved.
  Version history with restore.
- 🗂️ **Planner mode.** Many weddings per account, and a library of reusable
  processionals, box sets and bar settings.
- 🧭 **Guided tour** with an example wedding (100 guests, 27 day blocks), and
  a ⌘/Ctrl-K command palette.

---

## Target audiences

### A) DIY and budget-conscious couples

**Who:** couples planning their own wedding, often with a venue and caterer
but no paid planner. They live in spreadsheets, Pinterest and group chats.

**Pain:** the "free" planning apps are paid for some other way: vendor
marketplaces, registry commissions, ads and upsells to printed goods. The
tools also do not talk to each other. The seating chart, the place cards and
the run sheet are three copies of the guest list that drift apart.

**What we say:**

- Free. Not free-trial, not freemium. There is no paid version to be upsold
  to.
- No sign-up to start. Open it and plan. Your guest list stays on your device
  unless you choose to sync.
- Print your own place cards with the table numbers already filled in.
- Import the guest list you already have, from Joy, Zola, The Knot or a
  spreadsheet.

**On savings:** the savings are real but specific. Keep the claim to things
the product replaces:

1. **Seating chart software.** Some is paid; this is not.
2. **Place card and table sign printing.** You print at home with numbers
   bound from the seating plan, instead of paying per card for a stationer
   to typeset names.
3. **Planner-grade run sheets and call sheets.** People otherwise pay for
   these as subscription software or as a coordinator's time.

The brief suggested "save $300–$1,000+". That figure is **not verified**, and
the planning tools of Zola, The Knot and Joy are free to use. Do not publish a
dollar figure until someone has priced real alternatives, with sources and a
date. What we *can* say without a source: "no paid tier, no upsell, no
per-guest pricing."

**Where they are:** r/WeddingsUnder10k, r/weddingplanning, r/Weddingsunder5k,
UK wedding forums (Trousseau is UK-built: bar units, "licence"), wedding
TikTok and Instagram, Pinterest.

### B) Self-hosters and tech-savvy users

**Who:** people who run Jellyfin, Immich or Home Assistant, and who are now
planning a wedding (theirs, a sibling's, a friend's).

**Pain:** a guest list is a spreadsheet of names, emails, dietary needs
(which can be health data) and family relationships. It sits on a platform
whose business is vendor leads.

**What we say:**

- Local-first. With no account, the wedding lives in IndexedDB and nothing
  leaves the device.
- Self-host it with your own domain and your own Supabase (accounts and sync
  are optional).
- **No analytics off Vercel.** The page counter renders only on Vercel;
  Sentry only with a DSN you set.
- Export everything as one JSON file whose schema is an MIT-licensed npm
  package.
- AGPL, so nobody can take it closed.

**Be upfront about what is not there:** there is **no Docker image**, and that
is deliberate (see `docs/SELF-HOSTING.md`). It is a Next.js app plus an
optional Supabase project. r/selfhosted will ask about this in the first
five comments. The copy answers it before they ask, and invites the
discussion instead of promising an image.

**Where they are:** r/selfhosted, r/homelab, Hacker News, Lobsters, the
Fediverse (Mastodon: #selfhosted, #opensource), awesome-selfhosted.

### C) Open-source contributors

**Who:** TypeScript and React developers looking for a well-kept project with
a real user base and a clear path to a first PR.

**What we say:**

- Modern stack: Next.js 16, React 19, TypeScript, Zustand, zod 4, Tailwind 4,
  Supabase (Postgres + RLS), Vitest, Playwright with axe.
- A test suite that means it: over 1,800 test cases across 230+ test files,
  plus end-to-end runs against the production build. RLS is tested against
  PGlite.
- Decisions written down. Every subsystem has a dated spec and plan in
  `docs/superpowers/`, so you can tell whether an idea fits before writing
  code.
- A guide to adding a whole tool (`docs/BUILDING-A-TOOL.md`), and a documented
  data contract that preserves keys a tool does not know about.
- Built in the open with Claude Code. Around half the commits are co-authored
  with it. That is a story worth telling honestly (see the HN copy).

**Where they are:** Hacker News, r/opensource, r/webdev, r/nextjs, r/reactjs,
dev.to, Hashnode, GitHub topics, "good first issue" aggregators (goodfirstissue.dev,
up-for-grabs.net).

---

## Channels and sequencing

| Week | Channel | Asset | Goal |
| --- | --- | --- | --- |
| 0 | GitHub | New README, CONTRIBUTING, ROADMAP, repo topics, social preview image, 5–10 `good first issue` labels | Convert the traffic that is about to arrive |
| 1 (Tue–Thu, 8–10am US Eastern) | Hacker News | `copy/hacker-news.md` | Stars, technical feedback |
| 1 (+1 day) | r/selfhosted | `copy/reddit-posts.md` §1 | Self-host installs, Docker discussion |
| 1 (+2 days) | Twitter/X + LinkedIn | `copy/social-media.md` thread | Builders' audience, Claude Code angle |
| 2 | r/opensource or r/webdev | `copy/reddit-posts.md` §3 | Contributors |
| 2 | r/WeddingsUnder10k | `copy/reddit-posts.md` §2 | Couples using the hosted app |
| 2–6 | TikTok, Reels, Shorts | `copy/social-media.md` video scripts | Couples, long tail |
| Ongoing | Blog (`suite/app/blog`) | Guides for couples who search | SEO |

**Rules for every post:**

1. Read each subreddit's current self-promotion rules on the day. They change.
2. Post from the maintainer's own account, in the first person, and stay in
   the thread for the first three hours.
3. Never post a real guest list or real names in a screenshot. Use the
   tour's example wedding.
4. Spread posts over days. Posting the same link to five communities in an
   hour reads as spam and gets removed.

## Before launch: checklist

- [ ] Add repo topics: `wedding`, `wedding-planner`, `seating-chart`,
      `self-hosted`, `local-first`, `nextjs`, `supabase`, `typescript`,
      `open-source`.
- [ ] Set the repository social preview image (Settings → General) to
      `marketing/assets/images/social-preview.png` (1280×640).
- [x] Record the GIFs and put them in the README (see "Assets" below).
- [ ] Open 5–10 issues labelled `good first issue`. Candidates: the tool
      proposals in `ROADMAP.md`, one per issue.
- [ ] Enable GitHub Discussions, so questions do not become issues. The
      README, ROADMAP and landing page link to it for the Docker question.
- [ ] Enable **private vulnerability reporting** (Settings → Code security).
      `CONTRIBUTING.md` sends security reports there.
- [ ] Publish `marketing/landing-page/` (GitHub Pages from the repo root, or a
      Vercel project) and put its URL in the repo's "About" box. The page
      loads its images and clips from `../assets/`. If you host the folder on
      its own, copy those files beside it and change the references.
- [ ] Decide whether to archive the four standalone predecessor repos
      (roadmap subsystem C) so search traffic lands here.

## Assets

All captured from the guided tour's example wedding, never a real one. The
full index, and how to regenerate everything when the UI changes, is in
[`assets/README.md`](assets/README.md).

| Asset | Shows | Used in |
| --- | --- | --- |
| `motion/seat-to-card.{gif,mp4}` | Zainab dragged to Table 13, *Use the room*, her card reads "Table 13" | README, HN, thread 1/7, video 1 |
| `motion/ceremony-moves.{gif,mp4}` | Ceremony 13:30 → 14:00, the day follows; 14:30 flags a collision | README, thread 3/7, video 2 |
| `motion/binder.{gif,mp4}` | The Binder on a phone: now, day, ring, find, shots | README, Reddit couples post, video 3 |
| `images/social-preview.png` (1280×640) | Headline and Seating | GitHub social preview |
| `images/og-card.png` (1200×630) | The same, at link-card size | Landing page, link unfurls |
| `images/hero-*.png` (1600×1000) | One per tool, headline over the app | Blog, landing page, LinkedIn |
| `images/square-*.png`, `pledge.png` (1080×1080) | Carousel cards | Instagram, LinkedIn |
| `images/story.png` (1080×1920) | Vertical cover | Stories, Shorts and Reels covers |
| `images/tools-grid.png`, `binder-trio.png` | All eleven tools; three phones | README, HN, Reddit |

## Metrics

| Metric | Source | Week 1 target | Week 6 target |
| --- | --- | --- | --- |
| GitHub stars | GitHub | Record the baseline on launch day, then set targets | — |
| Hosted visits | Vercel Web Analytics (route-only, cookieless) | Baseline | — |
| Weddings created | Supabase `account_weddings` row count (aggregate only) | Baseline | — |
| Self-host signals | Issues and discussions mentioning self-hosting, forks | — | — |
| First-time contributors | Merged PRs from new authors | 1 | 5 |

Targets are left blank on purpose. Set them after launch-day baselines, not
before.

---

## Claims deliberately left out

These appeared in the brief but the repository contradicts them. **Do not add
them back without changing the code first.**

| Claim | Why it is out | What to say instead |
| --- | --- | --- |
| "Docker Compose / Deploy on Docker" | No Dockerfile or compose file exists. `docs/SELF-HOSTING.md` says there is no Docker image, on purpose. | "Runs anywhere Next.js runs. Local-only needs no backend; sync needs Supabase." A **Deploy with Vercel** button is real (the hosted instance runs on Vercel with root `suite`). |
| "RSVP tracking" | RSVP collection is explicitly deferred: "Joy and similar do it; Trousseau imports the result." | "Import your RSVPs from Joy, Zola or The Knot. Confirmed guests with no table are flagged." |
| "Menu selector" | There is no menu builder. Guests carry a main-course choice from the import, and dietary requirements are broken down. | "Dietary needs and main-course choices come in with your guest list and are counted as you seat people." |
| "Automatic seating algorithm" | Seating is manual, to scale, with rules (together/apart) and warnings. There is no solver. | "Keep-together and keep-apart rules, with warnings when you break them." The algorithmic story is the **Timeline resolver**. |
| "Zero tracking" (for the hosted site) | The hosted site counts page visits with Vercel Web Analytics (no cookie, and addresses cut to the route). | "No ads, no cookies, no data sales. The hosted site counts page visits, not people. Self-hosted, it counts nothing." |
| "The host can't read your guest link" | `wedding_shares.share_key` is stored in the database for members. The operator could decrypt. | "The key travels after the `#`, so it never appears in a request. The public endpoint only ever returns ciphertext." |
| "End-to-end encrypted" | Wedding data is encrypted at rest with RLS, not end-to-end. The README and Privacy Policy say so. | "Encrypted at rest; database rules stop any other account reading it; no admin panel." |
| "$300–$1,000+ saved" | Unverified. The big platforms' planning tools are free to use. | See "On savings" above. |

# Landing page copy: Knotwork

A section-by-section blueprint for `marketing/landing-page/index.html`. It keeps what already works there (the three live demos, the pledge, the self-host block) and changes the order and the headline so the page is written for couples first.

**Before using this:**

- `knotwork.app` is a **placeholder domain**. Replace it everywhere once a domain is bought.
- Every claim below was checked against the code or `marketing/STRATEGY.md`'s evidence table. The "claims deliberately left out" list there still applies.
- Voice: plain, British, first person where a person is speaking. No superlatives.

**What changed from the current page, and why**

| Change | Reason |
| --- | --- |
| Headline moves from mechanism ("without the tools disagreeing") to outcome ("change it once") | Couples buy the relief, developers buy the mechanism. The mechanism becomes the sub-headline. |
| New proof strip under the hero | The page had no social proof at all. |
| New "Sound familiar?" section | The page never named the reader's problem. |
| Tool grid regrouped by the order a wedding is planned in | Eleven equal cards read as a feature list. |
| New "Three ways to use it" block | Answers "do I need an account?" and replaces a pricing section. |
| New FAQ (10 questions) | There was none. It carries the objections from `02` §1. |
| New planner strip | Planner mode was built and never mentioned. |
| Self-host block moves below the FAQ | It is for a minority of visitors and was pushing the final CTA down. |

---

## Page metadata

| Field | Copy |
| --- | --- |
| `<title>` (56 chars) | Knotwork: free wedding planning tools that work together |
| Meta description (152 chars) | Seating chart, place cards, timeline and more, sharing one guest list. Change it once and everything updates. Free, no sign-up, no adverts, open source. |
| `og:title` | Knotwork: free wedding planning tools that work together |
| `og:description` | Seat your guests once, and the place cards, dietary counts and run sheet already know. Free, no sign-up, open source. |
| `og:image` | `https://knotwork.app/assets/images/og-card.png` — **absolute URL**. The current relative path will not unfurl. |
| `og:locale` | `en_GB` |

---

## 0. Navigation

`Knotwork` · Tools · Why it's free · Questions · Run your own · **[Start planning →]**

- Rename "Compare" to **Why it's free** and "Privacy" to nothing: privacy lives inside the pledge.
- The button is the only filled element in the bar.

---

## 1. Hero

**Eyebrow**
Free forever · No sign-up · Open source

**Headline (H1)**
Change the guest list once. The whole wedding updates.

**Sub-headline**
Seat your guests, and one click puts every table number on the place cards. Move the ceremony, and the rest of the day moves with it. Eleven planning tools that share one wedding, so nothing is typed twice.

**Primary CTA**
`[ Start planning, free → ]`

**Secondary CTA**
`[ Look around an example wedding ]`

**Microcopy under the buttons**
No account, no password, no card. Bring the guest list you already have.

**Media**
`motion/seat-to-card.mp4`, autoplay, muted, looped, with `hero-overview.png` as the poster. Alt text: "A guest is dragged onto Table 13; her place card then shows Table 13."

**Headline alternatives to test**

| # | Headline | Angle |
| --- | --- | --- |
| A (recommended) | Change the guest list once. The whole wedding updates. | Outcome |
| B (current) | Plan the whole wedding. Without the tools disagreeing. | Mechanism |
| C | Your seating chart, place cards and run sheet, finally agreeing. | Specific |
| D | The wedding planner with nothing to sell you. | Trust |

---

## 2. Proof strip

One line, small type, directly under the hero. Three items, each true today.

> **Built for one real wedding.** Now free for yours. · **Open source**, so you can check every promise on this page. · **No sign-up**: your guest list stays on your device.

**Placement notes**

- After launch, swap the middle item for a number once there is one worth showing: GitHub stars (live badge), or "N weddings planned" from the aggregate count. Do not show a number below about 100.
- When the first couple's story arrives through `/blog/share`, add one quote here with the names they chose. One real quote beats three stock ones. **Never invent a testimonial.**

---

## 3. Sound familiar?

**H2**
The guest list lives in three places. They don't match.

**Body**
The spreadsheet says 96. The seating chart says 94. The place cards went to print last Tuesday. Then someone's plus-one drops out, and you spend the evening fixing it three times.

It isn't you. Most wedding tools keep a separate copy of your guest list in every feature. When I planned mine, two of the apps we used disagreed about **what day the wedding was**.

So I built one where that can't happen.

**Three cards** (keep the existing icons)

| | Title | Body |
| --- | --- | --- |
| 📄 | One wedding, one guest list | Every tool reads the same list. There is no second copy to fall behind. |
| 🔁 | Change it once | Correct a name, and it's corrected on the seating plan, the place cards and the job sheets. |
| 🚩 | It notices what you'd miss | A table over capacity, a confirmed guest with no seat, two different dates: flagged before the day, not on it. |

---

## 4. Try it right here

Keep the existing three interactive demos. They are the best thing on the page.

**H2**
Don't take my word for it. Try it.

**Lead**
These small demos work the way the real tools do. The real ones are one click away, and just as free.

**Tab labels and captions**

| Tab | Caption |
| --- | --- |
| 🪑 Seating → Place cards | Pick a guest, then a table. Her place card takes the table from the room, and the dietary count keeps up. |
| 🕒 Timeline | Move the ceremony. Pinned blocks stay put; the rest follow. Drinks can run as short as 45 minutes before anything collides with dinner. |
| 💷 Money | Tick off what's paid. Suppliers, what's booked and what's left, against your budget. |

**CTA under the demos**
`[ Open the real thing → ]` No sign-up.

---

## 5. Feature breakdown

**H2**
Everything between "we're engaged" and "the car's here".

**Lead**
Six tools are there when you open it. Add the rest from the toolbox when your wedding needs them. Removing a tool only hides it; your work stays.

### Start with the people

| Tool | Headline | Body |
| --- | --- | --- |
| 👥 **Guests** | Bring the list you already have. | Import a CSV from Joy, Zola, The Knot or your own spreadsheet. It works out which column is which and shows you a preview before anything is saved. |
| 🪑 **Seating** | Your actual room, to scale. | Draw the room in real measurements and drag people onto seats. Tell it who to keep together and who to keep apart, and it warns you. Dietary needs are counted as you go. |
| 💌 **Place cards** | Print your own, table numbers included. | Your design, your card stock. Names and tables come from the seating plan. It won't print a card with a missing name or font, so you don't waste good card. |
| 📷 **Group shots** | The family photo list, written for you. | Built from who is related to whom, so nobody is left out of the picture. |

### Then the day

| Tool | Headline | Body |
| --- | --- | --- |
| 🕒 **Timeline** | A run of the day that re-times itself. | Pin what can't move; everything else follows. It shows what collides, what runs past the venue's curfew and what can't be reached in time, and it knows when golden hour is. |
| 📋 **Delegation** | Who's doing what, and when. | Hang jobs off each part of the day and give them to people from your guest list. Print a sheet for each helper. |
| 💍 **Ceremony** | Who walks, in what order, to what. | The processional, the order of service, music and readings, with cues on the Timeline. |

### Then everything else

| Tool | Headline | Body |
| --- | --- | --- |
| 💷 **Money** | What's paid and what's due. | Each supplier's cost against your budget. |
| ✅ **Checklist** | What to have done by when. | Every item with a date. |
| 🍷 **Bar** | How much to buy. | Bottles and cases for your guest count, and roughly what it costs. In UK units. |
| 📦 **Boxes** | What's packed where. | Which box, where it has to be, and by when. Labels and a packing list. |

### And on the day itself

**H3**
Plan on your laptop. Carry it on your phone.

**Body**
The **Binder** is your wedding day on your phone: what's on now, what's next, who to ring when the florist is lost, and which table Aunt Carol is on. It works without signal, because venues never have any.

- 🖨️ **One PDF pack.** The floor plan, run sheet, job list and photo list, in one file for whoever needs it.
- 🔗 **A link for each guest** that shows them their own seat and nothing else.
- 🔗 **A link for each supplier** that shows their part of the day and lets them confirm it.

**Media:** `binder-trio.png`, then `motion/binder.mp4`.

---

## 6. Pain-point comparison table

**H2**
"Free" isn't the same as free.

**Lead**
Most wedding apps cost nothing to use because someone else is paying: suppliers, registries, advertisers. Knotwork has nobody to answer to but you.

| When you… | With a spreadsheet | With a typical free wedding app | With Knotwork |
| --- | --- | --- | --- |
| **Get a late RSVP** | Update the list, then the seating tab, then the place card file | Update each feature separately | Change it once. Seating, cards and dietary counts follow |
| **Draw the table plan** | Boxes in cells | A basic layout tool | Your real room, to scale, with keep-apart rules |
| **Need place cards** | Mail merge and hope | Often offered as paid printed stationery | Print your own, with table numbers already on them |
| **Move the ceremony by 20 minutes** | Retype every time below it | Not usually a feature | The day re-times itself and tells you what no longer fits |
| **Brief your helpers and suppliers** | Forward the spreadsheet | — | A sheet per person; a link per supplier |
| **Lose signal at the venue** | It's in the cloud | It's in the cloud | The Binder works offline |
| **Want to start** | Open a blank sheet | Create an account | Open it. No account |
| **Wonder who's paying** | Nobody | Suppliers, registries, adverts, upsells | Nobody. There is no paid tier and never will be |
| **Want your data back** | It's yours | Varies | The whole wedding as one file |
| **Need RSVPs and a wedding website** | — | **Yes, and good at it** | **No.** Keep using Joy or similar, and import the RSVPs |

**Footnote (keep; it is what makes the table fair)**
"Typical" describes how the category is commonly funded and built, not any one product. Check each app's own terms. Knotwork doesn't collect RSVPs or host a wedding website, on purpose. Use it beside the one you have.

**Design note:** the last row is a row Knotwork loses. Leave it in. It is the reason the other nine are believed.

---

## 7. Three ways to use it

**H2**
Three ways to use it. All free. All the same tools.

| | **Just open it** | **Plan together** | **Run your own** |
| --- | --- | --- | --- |
| **For** | Trying it, or planning on one laptop | You, your partner and a planner | People who'd rather host it themselves |
| **Sign in** | No | A six-digit code by email, or Google or Apple. No password | Up to you |
| **Your wedding lives** | In your browser. Nothing is uploaded | Synced between you, encrypted at rest | On your own server |
| **You also get** | Every tool, every PDF | Live syncing, version history, guest and supplier links | Your own domain, and no page counting at all |
| | `[ Start planning → ]` | `[ Start, then sign in when you're ready ]` | `[ Read the guide ]` |

**Under the table**
There's nothing to upgrade to. Start without an account and add one later; your wedding comes with you.

**Do not** call these plans or tiers, and do not put a price row in the table.

---

## 8. The pledge

Keep the existing five points as written. They are accurate and the strongest prose on the page. One addition to the lead.

**H2**
The pledge

**Lead**
Written into the licence and the code, not just this page. If you can read code, you can check each one.

i. **Free, forever.** No paid tier, no premium features, no trial. The AGPL licence means nobody can take it closed and charge for it.

ii. **Your guests are not the product.** No adverts, no supplier leads, and guest data is never sold or shared for marketing. Account sync uses the storage provider described in the privacy policy.

iii. **Nobody browses your wedding.** There's no admin panel and no support login. Synced weddings are encrypted at rest and walled off by database rules. That isn't end-to-end encryption, and the privacy policy says so plainly.

iv. **Counting pages, not people.** The hosted site counts page visits with no cookie, cutting every address down to the page first. A copy hosted off Vercel counts nothing at all.

v. **You can always leave.** Download the whole wedding as one file, in an open format. Delete your account and your data goes with it.

---

## 9. For planners and coordinators

A short strip, not a section. New.

**H3**
Running someone else's wedding?

**Body**
Hold every wedding you're planning in one account. Build a processional, a packing list or a bar order once, and reuse it from your library. Send each supplier a link to confirm their part. It's free for every wedding you run, and your couples don't need to pay or install anything.

One planner per wedding, for now. It sits beside your CRM; it doesn't replace it.

`[ See planner mode → ]`

---

## 10. FAQ

**H2**
Questions

**Is it really free? What's the catch?**
There isn't one. There's no paid version, no trial and no adverts. A wedding is a small file, so it costs very little to host, and if you never make an account it costs nothing at all because it never leaves your browser. If it saves you an evening, there's a tip jar. A tip unlocks nothing.

**Do I need to create an account?**
No. Open it and start. An account only adds syncing between devices and planning with your partner or planner. When you want one, there's no password: you get a six-digit code by email, or you can use Google or Apple.

**I already have my guest list in a spreadsheet. Do I have to retype it?**
No. Export it as a CSV and import it. It also takes the exports from Joy, Zola and The Knot. It guesses which column is which, asks about the rest, and shows you a preview before anything is saved.

**Does it do RSVPs or a wedding website?**
No, on purpose. Services like Joy do that well and for free. Keep yours, and import the replies. Knotwork then flags any confirmed guest who doesn't have a table yet.

**Does it work on my phone?**
Planning is a laptop job: drawing a room and designing cards needs a screen. On the day, the Binder puts everything on your phone, and it works without signal.

**Will it seat my guests for me?**
No. You place people yourself. You can set keep-together and keep-apart rules, and it warns you when a table is over capacity or a rule is broken.

**Who can see my guest list?**
With no account, nobody: it stays in your browser. With an account, you, your partner and your planner, if you invite one. It's encrypted at rest and there is no admin panel. It is not end-to-end encrypted, which means whoever runs the server could in principle read the database. The privacy policy says exactly that. If that matters to you, use it without an account, or run your own copy.

**What happens if you stop running it?**
Your wedding downloads as one file, and that file opens in any copy of Knotwork, including one you run yourself. The code is open source, so it can't disappear.

**I'm not in the UK. Can I use it?**
Yes. It was built in the UK, so the bar calculator thinks in UK units and the guides cover English and Welsh law. The seating, place cards, timeline and everything else work anywhere.

**How do I say thanks?**
Tell another couple. If you're on GitHub, a star helps people find it. And if you'd like to, there's a Ko-fi.

**FAQ notes**

- Mark up with `FAQPage` structured data.
- Developer questions (Docker, Supabase, CRDTs) stay out of this list. They are answered in the self-host block and the README.

---

## 11. Run your own copy

Keep the existing block. Light edits.

**H2**
Run your own copy

**Body**
Your domain, your database, and no analytics. On your own machine it needs no backend at all. Add a free Supabase project when you want accounts and syncing.

- ✓ A Next.js app. Runs anywhere Node 20+ does
- ✓ Optional Supabase: Postgres with row-level security
- ✓ Every command in the guide was run on a fresh clone
- ✓ No Docker image yet. [Tell me if you'd use one]

```sh
# local only: no backend, no account
git clone https://github.com/JFrusher/Knotwork.git
cd Knotwork
npm ci
npm run build
npm run dev -w suite
# → http://localhost:3000
```

`[ Self-hosting guide ]` · `[ ★ Star on GitHub ]`

*(The clone URL assumes the repo has been renamed. Until then it is `JFrusher/Trousseau.git Knotwork`.)*

---

## 12. Final CTA

**H2**
Your wedding, in one place.

**Body**
Bring your guest list, or look around a finished example first. Either way, there's nothing to sign up for and nothing to buy.

`[ Start planning, free → ]` `[ Look around an example wedding ]`

**Microcopy**
Built for one real wedding. Now free for yours.

---

## 13. Footer

Knotwork · app AGPL-3.0-or-later · data contract MIT
Privacy · Terms · Guides · Share your story · Support · GitHub · Roadmap

**One new line**
Something missing, or something confusing? [Tell me.] *(mailto)*

---

## CTA inventory

One primary action on the page, repeated. Everything else is secondary.

| Position | Primary | Secondary |
| --- | --- | --- |
| Nav | Start planning → | — |
| Hero | Start planning, free → | Look around an example wedding |
| After demos | Open the real thing → | — |
| Three ways | Start planning → | Read the guide |
| Planner strip | See planner mode → | — |
| Self-host | Self-hosting guide | ★ Star on GitHub |
| Final | Start planning, free → | Look around an example wedding |

"Star on GitHub" appears once, in the self-host block. On the current page it shares the final CTA with "Start planning", which splits a couple's attention with a button they cannot use.

## Social proof placement

| Slot | Now | When available |
| --- | --- | --- |
| Under hero (§2) | "Built for one real wedding" | Star count, weddings planned, one quote |
| After demos (§4) | — | A named quote about the seat-to-card moment |
| Beside the comparison (§6) | — | A press or newsletter mention, as a logo or a line |
| Planner strip (§9) | — | One planner's name and business |
| Final CTA (§12) | "Built for one real wedding" | The best single quote |

## What to measure

Within the privacy policy: route-level page counts only.

| Question | Read |
| --- | --- |
| Does the page send people into the app? | Visits to `/` on the app with this page as referrer |
| Do they get as far as the tools? | Visits to `/guests`, then `/seating`, as a share of app visits |
| Which headline? | Run A for a fortnight, then B. No split-testing tool is needed and none should be added |

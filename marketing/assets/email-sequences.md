# Email sequences: Knotwork

Two sequences: **A**, three outreach emails to people who can put Knotwork in front of couples; and **B**, four welcome and onboarding emails for new users.

**Read this first**

| # | Point |
| --- | --- |
| 1 | The site is `knotwork-suite.vercel.app` (decided 2026-10-04: no new domain for the launch). |
| 2 | **Sequence B cannot be sent today.** Knotwork has no way to email users and no permission to. See "Before Sequence B" below. It is written so each email also works as an in-app message. |
| 3 | Sequence A goes to people in a professional capacity, one at a time, from your own address. It is not a mail merge. Under UK rules, sole traders count as individuals, so keep it personal, relevant to their work, and stop at the first "no". I'm not a lawyer; if this grows beyond a few dozen hand-written emails, check the ICO's guidance on direct marketing. |
| 4 | Everything in square brackets is for you to fill in. If a bracket can't be filled honestly, cut the sentence. |
| 5 | Plain text. No images, no tracking pixels, no link shorteners. That is consistent with the pledge, and it also lands in inboxes more reliably. |

---

# Sequence A · Outreach (3 emails)

## Who to send it to

| Priority | Who | Why they'd care | Version |
| --- | --- | --- | --- |
| 1 | UK wedding bloggers and budget-wedding newsletters | Their readers ask "how do I do a seating chart?" every week. A free tool with nothing to sell is an easy recommendation. | **A1** (below) |
| 2 | Independent planners and on-the-day coordinators | Planner mode, supplier links, the library. | **A2** opener |
| 3 | Open-source and self-hosting newsletters, podcasts | A finished, documented AGPL app with an unusual subject. | **A3** opener |
| 4 | Venue coordinators | They ask every couple for a table plan and dietary list. | A2, adapted |

Build the list by hand: 20 names to start, not 200. For each, note one specific thing they wrote or made. If you can't find one, don't email them.

## Timing

| Email | Day | Send only if |
| --- | --- | --- |
| 1 | Day 0, Tuesday to Thursday morning | — |
| 2 | Day 5 | No reply to email 1 |
| 3 | Day 12 | No reply to email 2 |

After email 3, stop. Do not send a fourth.

---

## A · Email 1 — the introduction

**Subject lines**

| # | Subject |
| --- | --- |
| 1 (recommended) | A free seating chart tool for your readers (nothing to sell) |
| 2 | Re your post on [topic]: a free tool that might be useful |
| 3 | Built this for our wedding, now free for anyone's |

**Body — A1, for bloggers and newsletter writers**

> Hi [Name],
>
> I read your piece on [specific post, e.g. "doing your own table plan"], and [one honest sentence about what was useful in it].
>
> I'm writing because I've made something your readers might want, and it's free with nothing behind it.
>
> When my partner and I planned our wedding, the guest list ended up in three places: the spreadsheet, the seating chart and the place cards. Every late RSVP meant fixing all three. So I built a tool where it's one list. Seat someone, and their place card already has the table number. Move the ceremony, and the rest of the day moves with it.
>
> It's called Knotwork. There's no paid version, no adverts and no sign-up: you open it and your guest list stays in your own browser. It's open source, so that can't change later.
>
> There's an example wedding already loaded if you'd like a look: knotwork-suite.vercel.app
>
> I'm not asking for a review. If it seems like something your readers would use, I'd be glad of a mention, and I'm happy to write up anything useful for you: a short guide to doing a table plan, say, with no pitch in it.
>
> Either way, thank you for [the post / the newsletter].
>
> Jacob
> [knotwork-suite.vercel.app · reply to this address]

**Opener swap — A2, for planners and coordinators**

Replace paragraphs 1 to 3 with:

> Hi [Name],
>
> I found [business name] through [where], and I'm writing because I've built something that might save you an evening per wedding, and I'd value a working planner's opinion of it.
>
> It began as a tool for my own wedding: one guest list shared by the seating plan, the place cards and the run of the day. It turned out to suit a planner better than a couple. So it now has a planner mode: every wedding you're running in one account, a run sheet that re-times itself when the ceremony moves, a link each supplier can open to confirm their part, and a library so you build a processional or a packing list once.

Keep paragraphs 4 and 5. Replace the ask with:

> I'm not selling it; there's nothing to buy. What I'd really like is ten minutes of honesty. If you opened the example wedding and told me where it would get in your way on a real one, that would be worth more to me than anything.

**Opener swap — A3, for open-source newsletters and podcasts**

Replace paragraphs 1 to 3 with:

> Hi [Name],
>
> I've been reading [newsletter / listening to the show] since [honest detail], and I have a project that might fit [the section it would fit].
>
> Knotwork is an open-source wedding planner (AGPL) built on one idea: eleven tools share a single JSON document, each tool rewrites only its own slice, and tools communicate only by reading each other's. It's local-first, needs no account, and self-hosts as a Next.js app with optional Supabase. No Docker image, on purpose, and I say why in the README.

Replace the ask with:

> The repo has a dated spec and plan for every subsystem, including where the plans turned out to be wrong, which may be the more interesting story: [repo URL]. Happy to answer anything.

---

## A · Email 2 — the useful follow-up

Sent on day 5, as a reply in the same thread. It gives something; it does not ask again.

**Subject:** Re: [original subject]

> Hi [Name],
>
> No need to reply to this. I thought one thing might be useful whether or not you ever mention the tool.
>
> [Choose one, and attach or link it:]
>
> **For bloggers:** I wrote a short guide to [how much drink to buy for a UK wedding / what a registrar will and won't allow for ceremony music / the four boxes to pack for the day]. No sign-up, no pitch: knotwork-suite.vercel.app/blog/[slug]. You're welcome to link to it or borrow from it.
>
> **For planners:** here's the PDF pack the example wedding produces: floor plan, run sheet, job list and photo list in one file. It's the quickest way to judge whether the output is good enough to put in front of a client. [attach]
>
> **For newsletters:** the part readers tend to argue about is the merge rule, so here it is in one paragraph: [link to README "How it works"].
>
> That's all. Thanks again for [their work].
>
> Jacob

---

## A · Email 3 — the close

Sent on day 12. Short. It makes it easy to say no.

**Subject:** Re: [original subject]

> Hi [Name],
>
> Last one from me, I promise.
>
> If Knotwork isn't right for [your readers / your business / the show], no problem at all, and you needn't reply.
>
> If it's just bad timing, it'll still be there, and still free: knotwork-suite.vercel.app
>
> And if you did take a look and something put you off, I'd honestly rather hear that than nothing. One line is plenty.
>
> All the best with [something specific and current: the season, the next issue],
>
> Jacob

## Sequence A: what to track

By hand, in a spreadsheet. No tracking pixels.

| Column | |
| --- | --- |
| Name, outlet, type | |
| The specific thing you referenced | |
| Dates sent: 1, 2, 3 | |
| Reply: yes / no / not interested | |
| Outcome: mention, link, feedback, nothing | |
| What they said | The most valuable column |

Reasonable expectation for careful, hand-written outreach to 20 people: a handful of replies and one or two mentions. That is an assumption, not a benchmark. If nobody replies to the first 20, change the email before sending 20 more.

---

# Sequence B · Welcome and onboarding (4 emails)

## Before Sequence B: what has to be true

This sequence was asked for, and it is written below, but **it must not be sent to existing sign-in addresses.**

| Fact | Source |
| --- | --- |
| People who use Knotwork without an account never give an email address. | `README.md`, `suite/.env.example` |
| People with an account give one for sign-in. The Privacy Policy says an account "stores your email address" so partners can plan on separate devices. It says nothing about tips or updates. | `suite/lib/legal.ts` |
| Sign-in emails are sent by Supabase. No other email service is listed as a processor. | `suite/lib/legal.ts` |
| The pledge says "your guests are not the product" and "no upsell". An unrequested drip from a sign-in address would undercut it. | Landing page |

**Two ways to make it possible. Choose one.**

| | Option 1: in the app (recommended) | Option 2: opt-in email |
| --- | --- | --- |
| How | The same four messages appear in the front page's "Next" card and the guided tour, at the moment each becomes relevant. | An unticked box at sign-in: "Email me four short tips on getting set up. Nothing else, ever." |
| Reaches | Everyone, including people with no account | Account holders who tick the box |
| Needs | Some front-end work | A sending service, a Privacy Policy update naming it, an unsubscribe link, a consent record |
| Risk to trust | None | Low, if the box is unticked by default and the promise is kept |
| Triggered by | What the wedding actually contains | Time since sign-up, or milestones if you build them |

The app already knows what each email needs to know ("3 guests have no table yet" is on the front page today). That is a better trigger than a calendar, which is the main reason to prefer option 1.

Each email below has an **in-app version**: one or two lines for the "Next" card.

## Sequence map

| # | Send | Trigger (better than a timer) | Goal | One action |
| --- | --- | --- | --- | --- |
| B1 | At opt-in | Account created | Reach the first "aha" | Import the guest list |
| B2 | Day 2 | Guests imported, no tables yet | Draw the room, seat a table | Open Seating |
| B3 | Day 5 | 10+ guests seated | See the link between tools | Press *Use the room* in Place cards |
| B4 | Day 10 | A timeline exists, or no activity | Plan the day; meet the Binder; invite the partner | Pin the ceremony |

**Exit conditions:** unsubscribe; account deleted; wedding date has passed. If someone has already done the action an email asks for, skip that email.

**Rules for all four:** one idea, one link, under 150 words, plain text, signed by a person, unsubscribe in one click, and a reminder in every footer that there are only four.

---

## B1 · Welcome — sent at opt-in

**Subject lines**

| # | Subject |
| --- | --- |
| 1 (recommended) | Start with the guest list you already have |
| 2 | Welcome to Knotwork (1 of 4) |
| 3 | The first five minutes |

**Preview text:** One import, and every tool has your guests.

> Hi,
>
> Jacob here. I built Knotwork for my own wedding and now look after it for everyone else's.
>
> You ticked the box for four short emails. This is the first, and there will only ever be four.
>
> **The one thing worth doing today: bring in your guest list.**
>
> Export it as a CSV from wherever it lives now: your spreadsheet, Joy, Zola or The Knot. In Knotwork, open **Guests** and import it. It works out which column is which and shows you a preview before anything is saved.
>
> Every other tool builds on that list, so it's the only thing you'll ever type once.
>
> → Open Guests: knotwork-suite.vercel.app/guests
>
> Not ready? The guided tour has a finished example wedding with 100 guests you can poke at instead.
>
> Jacob
>
> —
> 1 of 4. Unsubscribe in one click: [link]. Nothing here is for sale, and there's no paid version.

**In-app version**
> **Start with the guest list you already have.** Import a CSV from your spreadsheet, Joy, Zola or The Knot. `[Import guests →]`

---

## B2 · The room — day 2

**Subject lines**

| # | Subject |
| --- | --- |
| 1 (recommended) | Draw your actual room |
| 2 | If it doesn't fit here, it won't fit on the day |
| 3 | Uncle and ex-uncle: keeping people apart |

**Preview text:** To scale, in real measurements.

> Hi,
>
> Most seating charts are circles on a page. This one is your real room.
>
> In **Seating**, draw the room in real measurements and drag tables into it. If ten round tables don't fit on screen, they won't fit at the venue either, and it's better to find that out now.
>
> Then drag people onto seats. Two things worth knowing:
>
> - **Keep apart, keep together.** Tell it which guests shouldn't share a table, or must. It warns you if you break your own rule.
> - **Dietary counts keep up.** As you seat people, it totals the vegetarians, the coeliacs and everyone else, which is the list your caterer is about to ask for.
>
> Start with one table. The rest goes quickly.
>
> → Open Seating: knotwork-suite.vercel.app/seating
>
> Jacob
>
> —
> 2 of 4. Unsubscribe: [link].

**In-app version**
> **[N] guests have no table yet.** Draw your room to scale and drag them in. `[Seat them →]`
> *(This card already exists on the front page.)*

---

## B3 · The moment it clicks — day 5

**Subject lines**

| # | Subject |
| --- | --- |
| 1 (recommended) | Your place cards already know the table numbers |
| 2 | One button: Use the room |
| 3 | The bit I built this for |

**Preview text:** Seat someone, press one button, print.

> Hi,
>
> This is the part I built Knotwork for.
>
> Open **Place cards** and press **Use the room**. Every guest you've seated now has a card with their name and their table number on it. You didn't type either.
>
> Move someone to a different table next week, and their card changes with them.
>
> You can put the names and table numbers onto your own design and print on your own card. It checks before it prints: if a name or a font is missing, it tells you, so you don't waste a sheet.
>
> The same list also writes your **group photo list**, from who's related to whom.
>
> → Open Place cards: knotwork-suite.vercel.app/place-cards
>
> If something here doesn't work the way you expected, just reply. It comes to me.
>
> Jacob
>
> —
> 3 of 4. Unsubscribe: [link].

**In-app version**
> **Your place cards are ready to fill.** [N] guests are seated. Press *Use the room* and every card gets its table number. `[Open Place cards →]`

---

## B4 · The day itself — day 10

**Subject lines**

| # | Subject |
| --- | --- |
| 1 (recommended) | Now the day itself (last one from me) |
| 2 | Pin the ceremony. Let everything else follow |
| 3 | For the day: your wedding on your phone, no signal needed |

**Preview text:** A timeline that re-times itself, and a binder for your pocket.

> Hi,
>
> Last email. Three things for the day itself.
>
> **1. Pin what can't move.** In **Timeline**, pin the ceremony and anything else with a fixed time. Let the rest follow. If the ceremony shifts by twenty minutes, drinks, photos and dinner shift with it, and it tells you if anything now runs past the venue's curfew.
>
> **2. Put it in your pocket.** The **Binder** is the whole day on your phone: what's on now, who to ring, where a guest is sitting. It works without signal. Add it from the toolbox.
>
> **3. Share the load.** Invite your partner from the account page, and you'll both see changes as they're made. There's also one PDF with the floor plan, run sheet, jobs and photo list for whoever's helping.
>
> → Open Timeline: knotwork-suite.vercel.app/timeline
>
> That's all four. You won't hear from me again unless you write first, and I hope you do, especially if something's missing. Every tool in Knotwork started as someone's answer to "what are you still doing in a spreadsheet?"
>
> Have a wonderful day.
>
> Jacob
>
> P.S. Once it's all over, other couples would love to hear how it went: knotwork-suite.vercel.app/blog/share
>
> —
> 4 of 4. That's the lot. Unsubscribe anyway: [link].

**In-app version**
> **Pin your ceremony time.** Everything after it will follow, and you'll see what collides. `[Open Timeline →]`
> Then, when a timeline exists: **Take it with you.** Add the Binder to see the day on your phone, even without signal. `[Add the Binder →]`

---

## Sequence B: notes

### What is deliberately not in it

| Left out | Why |
| --- | --- |
| A Ko-fi ask | Never before value. The Support page and footer carry it. |
| A fifth "we miss you" email | A wedding is planned once. Someone who has gone quiet has either finished or changed their mind. |
| A request for a review or a star | Couples aren't on GitHub. The P.S. in B4 is the only ask, and it is for other couples' benefit. |
| Feature announcements | The promise is four emails. Keep it. |
| Images and tracking | Plain text is consistent with the pledge. |

### If option 2 is built: what to measure

Without open tracking, measure what the app already counts.

| Email | Signal that it worked | Source |
| --- | --- | --- |
| B1 | Visits to `/guests` rise in the day after sends | Vercel route counts |
| B2 | Visits to `/seating` | same |
| B3 | Visits to `/place-cards` | same |
| B4 | Visits to `/timeline`; partner invites | Route counts; aggregate membership count |
| All | Replies | Your inbox. The best signal of the lot |
| All | Unsubscribes after B1 | Sending service. If more than a few per cent leave after one email, the opt-in wording over-promised |

### One test worth running

Subject line 1 against subject line 2 on B1, once there are a few hundred opt-ins. Below that, any difference is noise.

### A milestone email worth adding later

Not part of the four, and only with a separate opt-in: one email **two weeks before the wedding date** ("Three things to print, and one to put on your phone"). It is the single most useful moment to hear from Knotwork, and it is the retention metric in `03_LAUNCH_EXECUTION_PLAYBOOK.md` §3. In the app, the same message belongs on the front page when the countdown passes 14 days.

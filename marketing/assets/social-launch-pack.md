# Social launch pack: Knotwork

Product Hunt, X, LinkedIn and Reddit. This adds to `marketing/copy/`; it does not replace it. The Show HN post, the r/selfhosted post and the seven-part build thread there are still the right copy for those places, after the one fix below.

**Before posting anything**

| # | Check |
| --- | --- |
| 1 | The site is `knotwork-suite.vercel.app` (decided 2026-10-04: no new domain for the launch). The repo is `github.com/JFrusher/Knotwork`. |
| 2 | **Sign-in is a six-digit emailed code, or Google or Apple.** It is not a magic link. Fix this in `marketing/copy/hacker-news.md` and `reddit-posts.md` before they go out. |
| 3 | Every personal detail (your wedding, the two apps that disagreed about the date) must be exactly as it happened. Edit anything that isn't. |
| 4 | Screenshots and clips use the example wedding only. Never a real guest list. |
| 5 | Read each community's rules on the day. I could not retrieve current rules for the wedding subreddits or r/selfhosted. |
| 6 | Post from your own account, in the first person, and stay for the first three hours. |

---

## 1. Product Hunt

### Listing fields

| Field | Copy | Length |
| --- | --- | --- |
| **Name** | Knotwork | 8 |
| **Tagline** (recommended) | Free wedding planning tools that agree with each other | 54 / 60 |
| Tagline, alternative A | Seat your guests once. The whole wedding updates. | 49 |
| Tagline, alternative B | The open-source wedding planner with nothing to sell you | 56 |
| **Topics** | Wedding Planning · Open Source · Productivity | |
| **Pricing** | Free | |
| **Links** | Website: `knotwork-suite.vercel.app` · GitHub: repo URL | |
| **First comment** | Maker comment, below | |

**Description** (252 / 260 characters)

> Seating chart, place cards, timeline and eight more tools that share one guest list. Seat a guest and her place card has her table. Move the ceremony and the day follows. No sign-up, no adverts, no paid tier. Open source, and you can run your own copy.

### Gallery, in order

| # | Asset | Caption |
| --- | --- | --- |
| 1 | `motion/seat-to-card.mp4` (as the video, or its first frame as image 1) | Seat a guest. Her place card has her table. |
| 2 | `images/hero-seating.png` | Your actual room, to scale. |
| 3 | `motion/ceremony-moves.gif` | Move the ceremony. The day follows. |
| 4 | `images/hero-place-cards.png` | Print your own, table numbers included. |
| 5 | `images/binder-trio.png` | The day on your phone, with or without signal. |
| 6 | `images/tools-grid.png` | Eleven tools. One wedding. |
| 7 | `images/pledge.png` | The pledge. |

Product Hunt's gallery is 1270×760. The hero images are 1600×1000, a slightly different ratio, so re-render at the right size with the pipeline (`compose.py`) instead of letting them be cropped. A 240×240 thumbnail is also needed: `suite/app/icon.svg` on the off-white background.

### Maker comment

> Hi Product Hunt 👋 I'm Jacob.
>
> When my partner and I were planning our wedding, two of the apps we used disagreed about what day it was.
>
> That was the funny version of a problem that wasn't funny at all the week before: the guest list lived in three places. The seating chart, the place cards and the run sheet each had their own copy, and every late RSVP meant fixing all three.
>
> So I built Knotwork for our wedding, and I've kept building it for other couples.
>
> **The idea is one wedding, shared by every tool:**
>
> 🪑 Seat a guest, press one button, and her place card has her table number
> 🕒 Move the ceremony by twenty minutes and the rest of the day, and everyone's jobs, move with it
> 🚩 It flags what falls between tools: a table over capacity, a confirmed guest with no seat
> 📱 On the day, the Binder puts it all on your phone, and works without signal
>
> **And it's free in the plain sense.** No paid tier, no adverts, no supplier leads, no "premium". You don't need an account: open it and your guest list stays in your browser. It's open source (AGPL), so that can't quietly change, and you can run your own copy.
>
> **What it doesn't do:** RSVPs or a wedding website. Joy and others do that well, and Knotwork imports their guest lists. It won't seat people for you either. And planning is a laptop job; the phone gets the day-of Binder.
>
> About half the commits were co-written with Claude Code, from specs and plans I wrote and approved first. They're all in the repo if you'd like to see how that went, including the places the plan was wrong.
>
> I'd love to know: **what job did you end up doing in a spreadsheet?** That question is how every tool in it got built.
>
> Try it (no sign-up): knotwork-suite.vercel.app

### Product Hunt notes

| Point | Detail |
| --- | --- |
| When | 12:01am Pacific. That is 8:01am UK for most of the year, but **7:01am UK between 25 October and 1 November 2026**, when the UK clocks have gone back and the US clocks have not. A Tuesday, Wednesday or Thursday. |
| Who posts | You. Makers post directly now. |
| What ranks | One 2026 guide describes ranking as a mix of upvotes, comment depth, click-through and shares, with specific comments counting for more than raw votes. Treat as one source's view. |
| What not to do | Do not ask for upvotes, anywhere. Ask people to *look and tell you what's missing*. |
| Expectation | Product Hunt's audience is builders, not engaged couples. Treat it as a link, a badge and some feedback. It ranks low in the channel table for that reason. |
| Reply to | Every comment, within the hour, for the first day. |

---

## 2. X / Twitter

Three launch posts for three audiences. Post them on different days. Each is written to work alone.

### Post 1 · The demo (couples) — single post with video

> If your seating chart, your place cards and your spreadsheet all have different guest counts, this is for you.
>
> Seat a guest once. Her place card already has her table.
>
> Free. No sign-up. No adverts. I built it for our wedding.
>
> knotwork-suite.vercel.app
>
> [Attach: `motion/seat-to-card.mp4`]

**Reply to your own post:**

> It also does the run of the day (move the ceremony and everything after it moves), jobs for your helpers, the family photo list, a bar calculator, and a day-of binder for your phone that works with no signal.
>
> It doesn't do RSVPs. Keep your RSVP site and import the list.

### Post 2 · The origin thread (builders) — 6 parts

**1/6**
> Two of the apps we used to plan our wedding disagreed about what day it was.
>
> So I built one where that can't happen, and made it free and open source.
>
> Here's the one rule that makes it work 🧵
>
> [Attach: `motion/ceremony-moves.mp4`]

**2/6**
> Wedding apps aren't short of features. The trouble is that every feature keeps its own copy of the guest list.
>
> Seating chart, place cards, run sheet: three copies, drifting apart until the week of the wedding.

**3/6**
> Knotwork is one JSON document per wedding with eleven tools around it.
>
> The rule: a tool rewrites only its own slice and copies everything else byte for byte, including keys from tools that don't exist yet.

**4/6**
> So tools talk only by reading each other.
>
> The timeline resolves the day into clock times. The jobs list reads those. Move the ceremony and every job moves, and nothing had to recalculate.

**5/6**
> What it isn't: end-to-end encrypted (encrypted at rest, and the privacy policy says so), Dockerised, or an RSVP site.
>
> What it is: local-first, no account needed, AGPL, and self-hostable with no analytics.

**6/6**
> Planning a wedding, or know someone who is? It's free, and the guest list never has to leave their laptop → knotwork-suite.vercel.app
>
> If you build things, the code and every design spec are here → github.com/JFrusher/Knotwork

*The existing seven-part thread in `marketing/copy/social-media.md` covers the Claude Code story. Use that one the following week; do not merge the two.*

### Post 3 · The pledge (trust) — single post with image

> Most "free" wedding apps are paid for by someone: suppliers, registries, advertisers.
>
> Knotwork isn't paid for by anyone.
>
> No paid tier. No adverts. No supplier leads. No account needed. Open source, so you can check.
>
> It exists because I needed it.
>
> knotwork-suite.vercel.app
>
> [Attach: `images/pledge.png`]

### Spare single posts

| Use | Copy |
| --- | --- |
| Timeline demo | Your ceremony runs 20 minutes late. How many things on the run sheet do you have to change? In Knotwork: one. [`ceremony-moves.mp4`] |
| Binder | Venues never have signal. Your wedding day should still fit on your phone. [`binder.mp4`] |
| One-liner | Wedding apps keep three copies of your guest list. Knotwork keeps one. Free, open source, no sign-up. |
| Ask | What's the one wedding planning job you ended up doing in a spreadsheet? (Building a list.) |

**Hashtags:** at most two per post. Couples: #weddingplanning #diywedding. Builders: #opensource #buildinpublic.

---

## 3. LinkedIn

Two posts, written for LinkedIn, not adapted from X. No numbering, short paragraphs, link in the first comment.

### Post 1 · The builder's story (engineers, product people)

> Two of the apps my partner and I used to plan our wedding disagreed about what day it was.
>
> So, naturally, I built my own.
>
> It's called Knotwork. It's a set of wedding planning tools (seating, place cards, the run of the day, who's doing what, and seven more) built around one rule:
>
> Every tool shares one document. Each tool writes only its own part and reads everyone else's.
>
> That one rule is why seating a guest puts her table number on her place card, and why moving the ceremony re-times every job that hangs off it. Nothing is synced between tools, because there is only one copy.
>
> Three things I'd pass on from building it:
>
> 1. Write the spec, then the plan, then the code, and record where the plan turned out to be wrong. About half the commits were co-written with Claude Code, and that paper trail is what made it work. The gaps between "what we expected" and "what we found" are where the bugs were.
>
> 2. Test your promises against the code, not against your own wording. A test meant to keep our privacy policy honest checked the policy's text. Analytics were added and it never noticed. It now reads the code that collects data.
>
> 3. Decide what you won't build. There is no paid tier, no RSVP collection and no admin panel that can read a couple's data. Each of those is written down as "not planned, on purpose", and it has saved more time than any feature.
>
> The wedding has happened. The tool is now free and open source for anyone else's.
>
> If you know someone who's just got engaged, I'd be grateful if you sent it their way. Link in the comments.
>
> #OpenSource #SoftwareEngineering #ProductDevelopment

**First comment:**
> Try it, no sign-up: knotwork-suite.vercel.app
> Code, specs and plans: github.com/JFrusher/Knotwork

**Attach:** `images/hero-overview.png`, or a document carousel of `square-overview`, `square-seating`, `square-place-cards`, `square-timeline`, `pledge`.

### Post 2 · For planners and coordinators

> A question for anyone who plans or coordinates weddings.
>
> How many times this season have you rebuilt the same run sheet?
>
> I built a free tool for my own wedding that ended up solving a planner's problem more than a couple's, so I've added a planner mode. It's called Knotwork.
>
> What it does for someone running several weddings:
>
> → One account, every wedding you're working on.
>
> → A run of the day that re-times itself. Pin the ceremony and the dinner; let everything else follow. Move one thing and it shows you what now collides, what runs past curfew, and what can't be reached in time.
>
> → Supplier links. Each supplier sees their part of the day and confirms it. No login for them.
>
> → A library. Build a processional, a packing list or a bar order once and reuse it for the next couple.
>
> → A day-of binder on your phone that works without signal: what's on now, who to ring, where a guest is sitting.
>
> → One PDF pack: floor plan, run sheet, job list, photo list.
>
> What it doesn't do: contracts, invoices or client management. It sits beside your CRM. And for now it's one planner per wedding.
>
> It costs nothing, for you or your couples, and there is no paid version coming. It's open source and I run it as a personal project.
>
> I'd value ten minutes of a working planner's honesty more than anything. If you try it on a real wedding and it gets in your way, please tell me where.
>
> Link in the comments.
>
> #WeddingPlanner #WeddingIndustry #EventPlanning

**First comment:**
> knotwork-suite.vercel.app — no sign-up needed to look around. There's an example wedding with 100 guests and a full day already in it.

**Attach:** `images/hero-timeline.png`, or `motion/ceremony-moves.mp4` uploaded natively.

**LinkedIn notes**

| Point | Detail |
| --- | --- |
| Timing | Tuesday to Thursday morning, UK time. |
| Links | In the first comment, as `marketing/copy/social-media.md` already advises. |
| Tagging | Do not tag people who haven't used it. |
| Post 2 audience | Your own network probably holds few planners. Its real use is as something to link to from the outreach emails. |

---

## 4. Reddit: the community post

One post for wedding communities. The existing `reddit-posts.md` §2 is a good feature list; this version leads with the reader's problem and asks for something, which is what keeps a post from reading as an advert.

**First choice of subreddit:** r/UKweddings (about 40k members; the product is UK-built). **Then, a week apart, adapted:** r/WeddingsUnder10k, r/weddingplanning.

**Before posting:** read the sidebar. Many wedding subreddits restrict self-promotion or require moderator approval. **Message the moderators first** with two lines: what it is, that it is free with nothing to sell, and ask whether a post is welcome. A yes from a moderator is worth more than the post.

**Title**

`We built our own seating chart tool because ours kept going out of date. It's free if anyone wants it (no sign-up, no ads)`

Alternatives:

- `Got fed up updating the guest list in three places, so I made a tool that does it once. Free, nothing to sign up for`
- `What wedding planning job did you end up doing in a spreadsheet? (I made a free tool for the ones I did)`

**Body**

> Posting with the mods' OK. I'm not selling anything; there's nothing to buy.
>
> We got married recently. The bit of planning nobody warns you about is the last fortnight: someone drops out, so you fix the spreadsheet, then the seating chart, then the place cards, then the list for the caterer. Four versions of the same guest list. At one point two of the apps we were using didn't even agree on the date.
>
> So I built something for us where it's all one list. We used it for ours, and I've since tidied it up for other people.
>
> What it's good at:
>
> - **Seating chart to scale.** You draw your actual room and drag people onto seats. You can tell it who needs keeping apart and it warns you.
> - **Place cards you print yourself.** Once people are seated, the cards already have the table numbers on. Change a seat and the card changes.
> - **A timeline for the day.** You pin the things that can't move and the rest follows. If the ceremony shifts, everything after it shifts too, and it tells you if you've run past the venue's curfew.
> - **A list of who's doing what**, with a sheet you can print for each helper.
> - **Everything on your phone on the day**, working without signal, because venues rarely have any.
>
> There's also a budget tracker, a checklist, a drinks calculator (how many bottles for your numbers) and a few others.
>
> What it's not:
>
> - It doesn't do RSVPs or a wedding website. A free RSVP site like Joy does that better, and you can import the guest list from one.
> - It won't work out the seating for you. You still have to decide where Uncle Dave goes.
> - The planning part needs a laptop. The phone bit is for the day itself.
>
> It's free, properly: no premium version, no ads, no supplier adverts. You don't need to make an account. It saves in your browser, so your guest list doesn't go anywhere unless you choose to sync with your partner. The code's public if that sort of thing matters to you.
>
> There's an example wedding in it if you just want a look round: knotwork-suite.vercel.app
>
> Mostly I'd like to know **what's missing**. What did you end up doing in a spreadsheet or on paper that you wish something had just done for you? Every tool in it started as an answer to that.

**Adapting for US subreddits**

| Change | To |
| --- | --- |
| "last fortnight" | "last two weeks" |
| Drinks calculator line | Add "(it's UK-built, so it thinks in UK units, but the bottle counts work anywhere)" |
| "Uncle Dave" | Keep. |
| Budget | No currency amounts in the post. |

**Replies to have ready**

| They say | You say |
| --- | --- |
| "What's the catch?" | "There isn't one. It costs me very little to host, and nothing at all for people who don't make an account, because then it never leaves their browser. There's a tip jar and it unlocks nothing." |
| "Is this an ad?" | "Fair question. I made it and I'm telling people about it, so in that sense yes. But there's nothing to buy and no account to make." |
| "Does it work on iPhone?" | "The day-of binder does. The planning tools need a laptop: drawing a room on a phone would be miserable." |
| "Can my partner and I both use it?" | "Yes. That's the one thing an account is for. No password: it emails you a six-digit code." |
| "I've already done my seating chart in X." | "Then keep it. If you export the guest list as a CSV you can bring it in later for the place cards or the timeline." |
| "Who can see my guest list?" | "With no account, nobody. With one, you, your partner and a planner if you invite one. It's encrypted at rest but not end-to-end, and the privacy page says exactly what that means." |
| "It's missing Y." | "Thank you, that's the useful bit. How did you end up doing Y?" Then write it down. |

**What makes this post work, so it survives editing**

1. It opens with a feeling the reader has had, not with the product.
2. It lists what the tool *doesn't* do, in the body, unprompted.
3. It ends with a question the reader can answer without trying the tool.
4. There is one link, and it is at the bottom.
5. No emoji, no bold product name, no feature count.

---

## 5. Posting order

| Day | Channel | Copy |
| --- | --- | --- |
| Tue | Hacker News | `marketing/copy/hacker-news.md` (after the sign-in fix) |
| Wed | r/selfhosted | `marketing/copy/reddit-posts.md` §1 |
| Thu | X thread (Post 2) + LinkedIn Post 1 | This file |
| Following Tue | Product Hunt | This file, §1 |
| Following Wed | X Post 3 (pledge) | This file |
| Following Thu | r/opensource or r/webdev | `marketing/copy/reddit-posts.md` §3 |
| Week 3 | X seven-part Claude Code thread | `marketing/copy/social-media.md` |
| January | r/UKweddings, X Post 1, LinkedIn Post 2, the three videos | This file, and `social-media.md` §2 |

Dates are in `03_LAUNCH_EXECUTION_PLAYBOOK.md`.

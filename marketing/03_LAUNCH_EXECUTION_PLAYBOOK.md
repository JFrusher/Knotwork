# 03 · Launch execution playbook: Knotwork

Written: Saturday 3 October 2026 · Uses `01` (audit), `02` (strategy) and the copy in `assets/` and `marketing/copy/`.

**The plan in five lines**

1. **Two waves.** Developers now (Tuesday 20 October). Couples in January. The first builds the proof the second needs.
2. **Four gates** before anything is posted: domain, sign-in claim fixed, images regenerated, landing page live.
3. **One post a day**, never the same link in two places on one day, and you in the thread for three hours each time.
4. **£0 on adverts.** The whole budget is a domain.
5. **Success is weddings planned**, measured only with what the privacy policy already allows.

Sized for one person at about 6–8 hours a week (assumption A2 in the audit). If you have less, cut from the bottom of each week, never from the gates.

---

## 1. Four-week roadmap

| Phase | Dates | Purpose |
| --- | --- | --- |
| **Pre-launch week 1** (T-14 → T-8) | Tue 6 – Mon 12 Oct | Fix the front door |
| **Pre-launch week 2** (T-7 → T-1) | Tue 13 – Mon 19 Oct | Prepare the repo and the outreach list |
| **Launch week** (T-0 → T+6) | Tue 20 – Mon 26 Oct | Developers: HN, r/selfhosted, X, LinkedIn |
| **Post-launch week** (T+7 → T+14) | Tue 27 Oct – Tue 3 Nov | Product Hunt, contributors, listen, fix |
| **Wave two** | From Mon 4 Jan 2027 | Couples |

### Gates: nothing is posted until all four are ticked

| # | Gate | Why it is a gate |
| --- | --- | --- |
| G-1 | A domain that says Knotwork points at the app | A couple who hears the name must be able to find it. Every image currently shows `trousseau-suite.vercel.app`. |
| G-2 | "Magic link" corrected to "a six-digit code by email, or Google or Apple" in README, STRATEGY, ROADMAP, HN and Reddit copy | The code contradicts the copy. Hacker News will check. |
| G-3 | Media regenerated with the new domain in the browser frame | 13 hero images and the social cards carry the old URL. |
| G-4 | Landing page deployed, with an absolute `og:image`, and the link preview tested | A relative `og:image` means every shared link has no picture. |

If a gate slips, the launch date slips. Do not launch on a `vercel.app` URL to keep a date.

---

### Pre-launch week 1 · Tue 6 – Mon 12 Oct · "Fix the front door"

| Day | Task | Output | Time |
| --- | --- | --- | --- |
| **Tue 6** (T-14) | Decide D1–D6 in `02` §5: market, domain, email or in-app, the word "only", the personal story, one wave or two | Six decisions written at the top of `marketing/STRATEGY.md` | 30 min |
| Tue 6 | Buy the domain. Add it to the Vercel project. Set the site URL environment variable so canonical links and Open Graph tags use it. Update the Supabase auth redirect URLs, or sign-in will break | **G-1** | 1 h |
| **Wed 7** | Rename the GitHub repo to `Knotwork` (GitHub redirects the old URL). Update badges, clone commands and `KO_FI`/issue links that name `Trousseau` | Repo renamed | 45 min |
| Wed 7 | Fix the sign-in claim everywhere. Search for "magic" | **G-2** | 30 min |
| **Thu 8** | Regenerate stills, clips and framed images through `marketing/assets/pipeline/`. Add Product Hunt sizes (1270×760 gallery, 240×240 thumbnail) | **G-3** | 1 h |
| Thu 8 | Update the root meta description in `suite/app/layout.tsx` | Fresh link previews | 5 min |
| **Sat 10** | Rewrite `marketing/landing-page/index.html` from `assets/landing-page-copy.md`. Keep the three demos | New page | 3 h |
| **Sun 11** | Deploy it. Make `og:image` absolute. Paste the URL into Slack, iMessage, X and LinkedIn's post inspector and check each preview | **G-4** | 1 h |
| Sun 11 | Add "Something missing? Tell me." mailto to the app footer | A feedback route for people without GitHub | 15 min |
| **Mon 12** | Fresh-clone test: follow `README` and `docs/SELF-HOSTING.md` exactly, on a clean machine or container | Proof the self-host path still works after the rename | 45 min |

**End-of-week check:** open the new domain on a phone you have never used it on. Is it obvious within five seconds what this is and what to press?

### Pre-launch week 2 · Tue 13 – Mon 19 Oct · "Get ready to be looked at"

| Day | Task | Output | Time |
| --- | --- | --- | --- |
| **Tue 13** (T-7) | GitHub: topics, social preview image, enable Discussions, enable private vulnerability reporting (the four unticked items in `STRATEGY.md`) | Repo ready | 30 min |
| Tue 13 | Open 5–10 `good first issue`s from the V1.5 table in `ROADMAP.md`, one per row | A path for contributors | 1 h |
| **Wed 14** | Check free-tier headroom on Vercel and Supabase. Read the rate limit on the write path. Decide what you will do if the hosted copy struggles (answer: say so in the thread, point at local-only use, which costs nothing) | A one-line contingency | 30 min |
| Wed 14 | Move `scratch/PRD.md` out of the repo or mark it historical. Update the "no social login" line in `PRODUCT-ROADMAP.md` | No contradictions for a reader to find | 15 min |
| **Thu 15** | Record baselines: stars, forks, weekly visits, `account_weddings` count, npm downloads | Row 0 of the KPI sheet | 20 min |
| Thu 15 | Re-run the test count. Put the real number in the HN post | An accurate claim | 10 min |
| **Sat 17** | Build the outreach list: 20 names (10 UK wedding bloggers or newsletters, 5 planners, 5 open-source newsletters or podcasts), each with one specific thing they made | Spreadsheet | 2 h |
| Sat 17 | Read LibreWeddingPlanner's repository. Decide whether "only" is true (D4) | USP wording settled | 30 min |
| **Sun 18** | Final read of the HN post and its seven prepared replies. Read r/selfhosted's rules as they stand today. Draft nothing new | Posts ready to paste | 45 min |
| Sun 18 | Ask two people who have not seen it to open the site while you watch, saying nothing. Note where they stop | Two real first impressions | 1 h |
| **Mon 19** (T-1) | Fix whatever Sunday showed, if it is small. Clear Tuesday afternoon | A free afternoon | — |

**End-of-week check:** all four gates ticked; baselines recorded; Tuesday 1pm–5pm UK is empty.

### Launch week · Tue 20 – Mon 26 Oct · "Developers"

#### Launch day: Tuesday 20 October (T-0)

All times UK (BST). 8–10am US Eastern is **1–3pm UK** on this date.

| Time | Action |
| --- | --- |
| 09:00 | Open the site in a private window. Run the tour. Make an account. Download the PDF pack. If anything is broken, stop and move the launch to Wednesday. |
| 12:30 | Eat. You will not get another chance. |
| **13:15** | **Post Show HN.** Title 1: `Show HN: Knotwork – open-source wedding planner where the tools share one document`. Link to the repo; app link in the first line of the text. |
| 13:16 | Do **not** share the HN link anywhere or ask anyone to upvote. Voting rings are detected and penalised. If friends want to help, they can find it themselves and leave a real comment. |
| 13:15–16:30 | Stay in the thread. Answer every technical question, fully, within minutes. Use the prepared replies as a base, not as paste. Concede good criticism in one line. |
| 16:30 | Short break. Note every objection raised more than once. |
| 17:00–19:00 | Second sitting, as US Pacific wakes up. |
| 21:00 | Record: HN points, comments, rank reached, stars, visits. Write down the three most common objections and the three kindest quotes (with usernames). |
| 21:15 | Stop. Do not post anywhere else today. |

**If HN does nothing** (under about 10 points after two hours): that is the common outcome and says little about the product. Carry on with Wednesday. A Show HN that got little attention may be reposted once after a few weeks; check HN's current guidance before doing so.

**If HN goes well:** watch the Supabase dashboard and error reports. Fix nothing unless it is broken. Collect every "I wish it did X".

#### Rest of launch week

| Day | Channel | Copy | Notes |
| --- | --- | --- | --- |
| **Wed 21** | r/selfhosted | `marketing/copy/reddit-posts.md` §1 | Read the rules that morning. Lead with the Docker question, as written. Stay three hours. |
| **Thu 22** | X thread + LinkedIn Post 1 | `assets/social-launch-pack.md` §2 Post 2, §3 Post 1 | If HN went well, quote one real comment. |
| **Fri 23** | Mastodon; Lobsters if you have an invite | `marketing/copy/social-media.md` §3 | Lobsters needs an existing account and tags; skip if you have neither. |
| **Sat 24** | Fix day | — | The top two objections from the week become issues or fixes. Reply to every email. |
| **Sun 25** | Outreach emails 1–10 (A3 to open-source newsletters; A1 to bloggers) | `assets/email-sequences.md` Part A | Hand-written first paragraph for each. UK clocks go back today. |
| **Mon 26** | Rest. Update the KPI sheet | — | |

### Post-launch week · Tue 27 Oct – Tue 3 Nov · "Listen, fix, widen"

| Day | Task | Copy / output |
| --- | --- | --- |
| **Tue 27** (T+7) | **Product Hunt**, 12:01am Pacific = **07:01 UK** (the UK is on GMT, the US has not changed yet). Post the maker comment immediately. Reply to every comment for the day | `assets/social-launch-pack.md` §1 |
| **Wed 28** | X Post 3 (the pledge). Outreach emails 11–20 (A2 to planners) | `assets/` |
| **Thu 29** | r/opensource **or** r/webdev, not both this week | `marketing/copy/reddit-posts.md` §3 |
| **Fri 30** | Outreach follow-up (email 2) to Sunday's ten | `assets/email-sequences.md` |
| **Sat 31** | Submit to awesome-selfhosted (read its contribution rules: it has requirements on licence, documentation and project age) and to AlternativeTo as an alternative to the seating tools | Two listings |
| **Sun 1 Nov** | Write "What launching taught me": what was asked, what was fixed, what was declined and why. Publish on the blog, link in Discussions | A reason for week-one visitors to return |
| **Mon 2** | Triage: label every issue; close or answer every Discussion; thank every first-time contributor by name | A tidy repo |
| **Tue 3** (T+14) | **Retrospective** (below). Update `marketing/STRATEGY.md`'s metrics table with real numbers | Decisions for wave two |

#### T+14 retrospective: five questions

| # | Question | Decides |
| --- | --- | --- |
| 1 | Which channel sent visitors who reached `/seating`? (not which sent the most visitors) | Where wave two's effort goes |
| 2 | What were the three most repeated objections? | The next three fixes, or three new FAQ entries |
| 3 | Did anyone who is actually planning a wedding write to you? | Whether the couple message is landing at all |
| 4 | Did Docker come up enough to change the decision? | Revisit the "not planned" entry, or don't |
| 5 | Is hosting cost still close to nothing? | Whether to publish the numbers on the Support page |

### Retention fortnight: what "post-launch retention" means here

A wedding is planned once, so retention is not weekly active use. It is three things:

| Audience | Retained means | What you do in T+0 → T+14 |
| --- | --- | --- |
| **Developers** | They come back to the repo | Reply to every issue within 48 hours. Merge a first outside PR quickly, even a typo. Publish the retrospective post. |
| **Couples** | They return in the fortnight before their date and print something | Nothing to do yet: build the "14 days to go" front-page card (see `email-sequences.md`, last section) before January. |
| **Planners** | They add a second wedding | Reply personally to every planner who answers the outreach. Ask to watch them use it for ten minutes. |

### Wave two: couples, from Monday 4 January 2027

Not part of the four weeks, but the reason for them. By then there are stars, a few quotes, a matching domain and a page that has been tested on strangers.

| When | Task |
| --- | --- |
| **November** | Publish three search-led guides (§2.4). Build the public drinks calculator page. Film the three video scripts. Add the "14 days to go" card. |
| **December** | Message moderators of r/UKweddings (and one Facebook group you can honestly join) to ask whether a post is welcome. Collect any couple stories that arrived through `/blog/share`. |
| **Mon 4 Jan** | r/UKweddings post (`social-launch-pack.md` §4). X Post 1 with the seat-to-card clip. |
| **Jan, weekly** | One short video a week (three scripts). LinkedIn Post 2. Outreach A1 to ten more UK wedding bloggers. |
| **Feb** | r/WeddingsUnder10k, adapted for US readers. Second retrospective. |

The January date rests on assumption A7 (UK engagements cluster between Christmas and Valentine's Day), which I did not verify. If your own search data shows another peak, move the date, not the plan.

---

## 2. Channel distribution strategy

### 2.1 Prioritisation: ICE

Each channel scored 1–10 for **I**mpact on the goal (weddings planned), **C**onfidence it will work for this product, and **E**ase for one person with no budget. Score = average. The scores are my judgement, not data. Re-score at T+14 with real numbers.

| # | Channel | ICP | I | C | E | **ICE** | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **GitHub README and repo hygiene** | 2 | 6 | 9 | 9 | **8.0** | 1 |
| 2 | **Show HN** | 2 | 8 | 5 | 8 | **7.0** | 1 |
| 3 | **r/selfhosted** | 2 | 6 | 7 | 8 | **7.0** | 1 |
| 4 | **SEO guides + public calculator pages** | 1 | 9 | 6 | 5 | **6.7** | 1 |
| 5 | **r/UKweddings and wedding subreddits** | 1 | 8 | 5 | 7 | **6.7** | 1 |
| 6 | **Hand-written outreach to wedding bloggers** | 1 | 7 | 5 | 6 | **6.0** | 2 |
| 7 | **awesome-selfhosted, AlternativeTo, directories** | 2, 1 | 5 | 7 | 6 | **6.0** | 2 |
| 8 | **X / Mastodon / Bluesky (builders)** | 2 | 4 | 6 | 8 | **6.0** | 2 |
| 9 | **r/opensource, r/webdev, r/nextjs** | 2 | 4 | 6 | 8 | **6.0** | 2 |
| 10 | **Short video: TikTok, Reels, Shorts** | 1 | 8 | 4 | 3 | **5.0** | 2 |
| 11 | **Planner outreach** | 3 | 7 | 4 | 4 | **5.0** | 2 |
| 12 | **LinkedIn** | 2, 3 | 3 | 5 | 8 | **5.3** | 3 |
| 13 | **Product Hunt** | 2 | 3 | 5 | 6 | **4.7** | 3 |
| 14 | **Pinterest** | 1 | 6 | 3 | 4 | **4.3** | 3 |
| 15 | **Facebook groups** | 1 | 7 | 3 | 3 | **4.3** | 3 |
| 16 | **Podcasts and newsletters (open source)** | 2 | 4 | 4 | 5 | **4.3** | 3 |
| 17 | **Paid search / paid social** | 1 | 5 | 3 | 2 | **3.3** | Not now |
| 18 | **Wedding fairs, printed cards at venues** | 1, 3 | 4 | 3 | 2 | **3.0** | Not now |

**Reading the table**

- **Tier 1** is the launch. Three developer channels for wave one; two couple channels for wave two.
- **Tier 2** is done once each, well, in the fortnight after.
- **Tier 3** is done only because the copy already exists and it costs an hour.
- **LinkedIn scores above short video but sits in Tier 3.** Ease lifts its score; its impact on weddings planned is the lowest in the table, and tier follows impact.
- **Product Hunt scores low on purpose.** Its audience builds products; it does not plan weddings. One 2026 guide quotes 50–300 sign-ups for a typical B2B launch and 500–1,500 for consumer productivity tools; treat those as one source's estimate, and a wedding planner fits neither group well. It is worth a morning for the link and the feedback, not a week of preparation.
- **SEO scores highest for couples** because it is the only channel where the couple comes to you at the moment of need ("how many bottles of wine for 100 guests"). It is also the slowest: expect nothing for two or three months.

### 2.2 Organic channels: tactics

#### Tier 1

| Channel | Tactic | Asset | Avoid |
| --- | --- | --- | --- |
| **GitHub** | README opens with the outcome line and the seat-to-card GIF. Topics set. Social preview set. Discussions on. Ten good-first-issues. Reply within 48 hours. | README, `ROADMAP.md` | Asking for stars in issues or posts. The README footer already asks once; that is enough. |
| **Show HN** | Title 1. Repo as the link. Lead with the merge rule and the resolver. State the AI co-authorship before anyone asks. Ask for criticism of the design. | `marketing/copy/hacker-news.md` | Superlatives. Sharing the thread link. Defending instead of conceding. |
| **r/selfhosted** | Lead with "no analytics on your instance" and answer Docker first. Ask a real question: app only, or app plus Supabase, in a compose file? | `reddit-posts.md` §1 | Posting the same day as HN. |
| **SEO** | See §2.4. | Blog | Thin "10 best wedding apps" lists. Write what a couple searches the week it matters. |
| **Wedding subreddits** | Moderator permission first. Problem-first post. End with a question. One link. | `social-launch-pack.md` §4 | Any language that sounds like a company. Cross-posting on one day. |

#### Tier 2

| Channel | Tactic |
| --- | --- |
| **Blogger outreach** | 20 hand-written emails. Offer a guide with no pitch in it. Three emails, then stop. |
| **Directories** | awesome-selfhosted (check its rules first), AlternativeTo (listed against PerfectTablePlan, TopTablePlanner and the big platforms' seating tools), opensource.com-style round-ups. Each is a permanent link. |
| **X / Mastodon / Bluesky** | Three posts in `social-launch-pack.md` plus the existing seven-part thread, spread over three weeks. Native video. Reply to people asking about wedding seating, with help first and the link second. |
| **Dev subreddits** | The four "lessons" are the post. The project is the footnote. |
| **Short video** | Three scripts exist. Film all three in one sitting in November. Burned-in captions. Post one a week from January. Do not start until you can commit to three. |
| **Planner outreach** | Five emails (A2). The goal is one planner who lets you watch. |

#### Tier 3

| Channel | Tactic |
| --- | --- |
| **LinkedIn** | Two posts. Link in the first comment. |
| **Product Hunt** | One morning. Maker comment ready. Reply to everything. Ask for nothing. |
| **Pinterest** | Pin the six square images and each blog post's header to boards named for the search ("wedding seating chart ideas"). Low effort, long tail, unproven. |
| **Facebook groups** | Only groups you can honestly join, and only by answering questions. Never a link drop. |

### 2.3 Paid channels

**Recommendation: spend nothing.** Three reasons.

1. There is no revenue, so every pound of advertising is a pound of personal money with no return.
2. Advertising platforms would mean adding tracking to measure it, which the pledge rules out.
3. Paid adverts for a product whose promise is "no adverts" is an awkward look.

If that ever changes, the only paid test worth running is the cheapest one that needs no tracking:

| Test | Budget | How to judge it without tracking |
| --- | --- | --- |
| Google Search, exact match, UK only: "free wedding seating chart", "wedding table plan maker" | £50, one fortnight | Vercel route counts to the landing page from `google` as referrer, against the fortnight before |

Non-profit advertising grants need a registered charity, which this is not.

### 2.4 SEO plan

The blog exists "to be found" (`sitemap.ts`). Four posts are live, all dated 29 September 2026. The next six, in order:

| # | Title | Intent | Tool it leads to |
| --- | --- | --- | --- |
| 1 | How to make a wedding seating chart (and keep it up to date) | Highest. The product's core job. | Seating |
| 2 | Wedding day timeline: a template you can move | High | Timeline |
| 3 | How to print your own place cards | High; replaces a paid service | Place cards |
| 4 | The family photo list: who to include, and in what order | Medium | Group shots |
| 5 | Who does what on the wedding day: a list to hand out | Medium | Delegation |
| 6 | How to import your guest list from Joy, Zola or The Knot | Low volume, high intent | Guests |

Search volumes were not checked. Before writing, look each up in Google Search Console (free) once the new domain has a few weeks of data, and reorder.

**Two structural moves**

| Move | Why |
| --- | --- |
| **Public calculator pages**, starting with drinks ("how much drink for N guests") | Already on the roadmap as 💭. A working calculator ranks and gets linked in a way an article does not. It is the single best SEO asset the product could have. |
| **Redirect the old domain** to the new one permanently, and keep it redirecting | The four live posts keep whatever standing they have. |

**Rules for every guide** (the existing four already follow them): answer the question in the first paragraph; say which country's rules it covers; one link to one tool, at the point it helps; no sign-up wall; a date.

### 2.5 The rules, restated

From `marketing/STRATEGY.md`, still right, plus two.

1. Read each community's rules on the day.
2. Your own account, first person, three hours in the thread.
3. Example wedding only. Never a real guest list.
4. One community per day.
5. **Never ask for upvotes or stars in a post.**
6. **Every couple-facing post says what it doesn't do.**

---

## 3. KPIs and success metrics

### 3.1 What can be measured

Only these four sources. Adding a fifth would break the privacy policy.

| Source | Gives | Limits |
| --- | --- | --- |
| **Vercel Web Analytics** | Visits per route, referrer, country, device type | No users, no sessions, no funnels. Counts pages, not people. |
| **Supabase aggregate counts** | Number of account weddings; number of memberships | Account holders only. Counts, never contents. |
| **GitHub Insights** | Stars, forks, clones, referrers, issues, PRs | Developers only. |
| **Your inbox and Discussions** | What people actually say | Small numbers. The most valuable source. |

**People who never make an account are invisible after the first page.** That is the cost of the promise, and it should be stated wherever numbers are quoted: "at least N weddings", never "N weddings".

### 3.2 The funnel

Built from routes, because routes are what is counted.

| Stage | Definition | Measured by |
| --- | --- | --- |
| **1. Visit** | Lands on the landing page or the app's front page | Route count: `/` |
| **2. Explore** | Opens the guest list | Route count: `/guests` |
| **3. Activate** | Opens Seating | Route count: `/seating` |
| **4. The click** | Opens Place cards after Seating | Route count: `/place-cards` |
| **5. Commit** | Creates an account wedding | `account_weddings` count |
| **6. Share** | Invites a partner or planner | Membership count ÷ weddings |
| **7. Use on the day** | Opens the Binder | Route count: `/binder` |

**Activation, defined:** a visit that reaches `/seating`. It is the first point at which someone has done more than look. As a ratio: visits to `/seating` ÷ visits to `/`.

This is a page-count ratio, not a conversion rate. One keen person opening Seating ten times looks like ten. Treat it as a direction, and compare it only with itself week to week.

### 3.3 Metrics and targets

Targets are **assumptions to be replaced at T+14**, not benchmarks. Each has a floor (below this, something is wrong), a target, and a stretch. Record the baseline on Thursday 15 October first.

#### Traffic

| Metric | Source | Floor (T+14) | Target (T+14) | Stretch | By end of Feb 2027 |
| --- | --- | --- | --- | --- | --- |
| Visits to landing page + app front page | Vercel | 1,000 | 5,000 | 20,000 | 3,000 a month, steady |
| Share of visits from search | Vercel referrer | — | — | — | 20% |
| Share of visits from the UK | Vercel country | 15% | 25% | — | 50% |
| GitHub repo unique visitors | GitHub | 500 | 2,500 | 10,000 | — |

#### Conversion

| Metric | Definition | Floor | Target | Stretch |
| --- | --- | --- | --- | --- |
| Landing → app | App `/` visits with the landing page as referrer ÷ landing visits | 20% | 35% | 50% |
| **Activation ratio** | `/seating` visits ÷ app `/` visits | 15% | 30% | 45% |
| The click | `/place-cards` ÷ `/seating` | 20% | 40% | 60% |
| Account creation | New `account_weddings` ÷ app `/` visits | 1% | 3% | 6% |

The account figure is expected to be low, and low is fine: the product's promise is that you don't need one.

#### Acquisition cost

There is no paid acquisition, so the usual figure is £0 and tells you nothing. Use two honest substitutes.

| Metric | Definition | Target |
| --- | --- | --- |
| **Cash cost per account wedding** | (domain + hosting, monthly) ÷ new account weddings that month | Under £1 |
| **Hours per activated visit, by channel** | Hours spent on a channel ÷ `/seating` visits it referred | Use it to rank channels at T+14 and stop the worst two |
| Hosting cost | Vercel + Supabase invoices | £0 until a free tier is passed; publish it yearly on the Support page |
| Tips | Ko-fi | Not a target. Record it; never optimise for it |

#### Activation and engagement

| Metric | Source | Floor (T+14) | Target (T+14) | End of Feb 2027 |
| --- | --- | --- | --- | --- |
| New account weddings | Supabase | 10 | 40 | 250 total |
| Weddings with two or more members | Supabase | 15% | 30% | 35% |
| Example-wedding tour opens | Route count, if the tour has its own route; otherwise not measurable | — | — | — |
| Messages from people planning a wedding | Inbox | 1 | 5 | 30 |

#### Retention

| Audience | Metric | Source | Target |
| --- | --- | --- | --- |
| **Couples** | Share of account weddings written to in the 14 days before their date | Supabase: wedding date against last-write time, as an aggregate count | 50% |
| **Couples** | Binder route visits on Saturdays, May to September | Vercel | Rising month on month |
| **Planners** | Accounts holding two or more weddings | Supabase aggregate | 5 by end of Feb 2027 |
| **Developers** | Issues answered within 48 hours | GitHub | 90% |
| **Developers** | First-time contributors with a merged PR | GitHub | 1 by T+14 · 5 by end of Feb |
| **All** | Wedding stories received through `/blog/share` | Inbox | 1 by end of Feb · 5 by end of summer 2027 |

The couples' retention figure needs the wedding date read alongside the last-write time. That is an aggregate query on data already held, returning one number. Check it against the Privacy Policy's wording before running it, and add a line to the policy if it is not already covered.

#### Community

| Metric | Floor (T+14) | Target (T+14) | Stretch | Notes |
| --- | --- | --- | --- | --- |
| GitHub stars | 50 | 300 | 1,500 | Entirely dependent on HN. A floor result is not a failure. |
| Forks | 5 | 20 | 80 | A self-hosting signal. |
| Self-hosting mentions in issues and Discussions | 2 | 8 | — | The Docker tally lives here. |
| Outreach replies (of 20) | 2 | 5 | 8 | |
| Mentions or links from outreach | 0 | 2 | 4 | |
| npm weekly downloads of the contract package | — | — | — | Record only. |

### 3.4 What each number triggers

A metric with no decision attached is not worth collecting.

| If, at T+14 | Then |
| --- | --- |
| Visits are at target but the activation ratio is under 15% | The page promises something the app's first screen does not deliver. Watch three people use it. Fix the first screen before wave two. |
| Activation is fine but "the click" is under 20% | People are not finding *Use the room*. Make it the front page's "Next" card after the first table is seated. |
| Stars are high and account weddings are near zero | Expected after a developer launch. Do not change the product. It is why wave two exists. |
| Docker is raised by more than about ten separate people | Reopen the decision in `ROADMAP.md`. A community-maintained compose file may be the answer. |
| Under 15% of visits are from the UK by February | The UK-first assumption is wrong, or the channels are. Re-read D1. |
| Hosting cost is no longer close to nothing | Publish the numbers on the Support page and say so plainly. Still no paid tier. |
| No one planning a wedding has written to you by end of January | The couple message is not landing, or not reaching anyone. Go and sit with two engaged couples before writing another post. |

### 3.5 The weekly sheet

One row a week, every Monday, ten minutes.

| Week | Visits `/` | `/guests` | `/seating` | `/place-cards` | Activation ratio | Account weddings (total) | 2+ members | Stars | Forks | Issues open | Messages from couples | Top referrer | One thing learned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15 Oct (baseline) | | | | | | | | | | | | | |
| 26 Oct | | | | | | | | | | | | | |
| 2 Nov | | | | | | | | | | | | | |

The last column matters most. Fill it in even when the numbers are flat.

---

## 4. One-page checklist

### Gates
- [ ] G-1 Domain live, sign-in still works
- [ ] G-2 "Magic link" corrected everywhere
- [ ] G-3 Media regenerated with the new domain
- [ ] G-4 Landing page live; link preview tested

### Before 20 October
- [ ] Six decisions (D1–D6) written down
- [ ] Repo renamed; topics; social preview; Discussions; vulnerability reporting
- [ ] 5–10 good-first-issues
- [ ] Root meta description updated
- [ ] `scratch/PRD.md` dealt with; "no social login" line corrected
- [ ] Fresh-clone test passed
- [ ] Hosting headroom checked
- [ ] Baselines recorded
- [ ] Real test count in the HN post
- [ ] Outreach list of 20
- [ ] LibreWeddingPlanner read; "only" decided
- [ ] Two strangers watched using it
- [ ] Tuesday afternoon cleared

### Launch week
- [ ] Tue 20 · Show HN, 13:15 UK
- [ ] Wed 21 · r/selfhosted
- [ ] Thu 22 · X thread, LinkedIn Post 1
- [ ] Fri 23 · Mastodon
- [ ] Sat 24 · Fix the top two objections
- [ ] Sun 25 · Outreach 1–10

### Post-launch week
- [ ] Tue 27 · Product Hunt, 07:01 UK
- [ ] Wed 28 · X Post 3; outreach 11–20
- [ ] Thu 29 · r/opensource or r/webdev
- [ ] Fri 30 · Outreach follow-ups
- [ ] Sat 31 · awesome-selfhosted, AlternativeTo
- [ ] Sun 1 Nov · "What launching taught me"
- [ ] Mon 2 · Triage
- [ ] Tue 3 · Retrospective; update `STRATEGY.md`

### Before January
- [ ] Three search-led guides
- [ ] Public drinks calculator
- [ ] Three videos filmed
- [ ] "14 days to go" front-page card
- [ ] Moderators of r/UKweddings asked

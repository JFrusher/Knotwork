# 01 · Marketing audit report: Knotwork

Audited: Saturday 3 October 2026 · Scope: every marketing, product and strategy file in the `Knotwork` folder, plus the code files needed to check the claims the copy makes.

**Verdict in one paragraph.** The product is finished and unusually well documented, and the existing marketing is better than "rough": it is accurate, has a clear idea ("the tools agree with each other") and comes with a regenerable media kit. What is missing is everything between "someone hears about it" and "someone keeps using it": no chosen primary audience, no deployed landing page, no domain that matches the name, no social proof, no way to hear from users, no targets, and no plan for the audience that actually plans weddings (couples) as opposed to the audience that upvotes repos (developers). Three claims in the current copy contradict the code and should be fixed before anything is posted.

---

## 1. How this audit was done

| Step | What | Evidence |
| --- | --- | --- |
| Inventory | Listed the whole folder (1,360 entries, excluding nothing) | `marketing/` 78 files, `docs/` 45, `suite/` 1,083 |
| Read in full | `marketing/STRATEGY.md`, `marketing/copy/*` (3), `marketing/assets/README.md`, `marketing/landing-page/index.html`, `README.md`, `ROADMAP.md`, `docs/PRODUCT-ROADMAP.md`, `scratch/PRD.md`, billing/legal spec | Quoted below |
| Read in part | `PLAN.md`, `docs/SELF-HOSTING.md`, `suite/lib/legal.ts`, expansion master plan (headings) | Used only to check claims |
| Claim checks against code | `suite/lib/tools.ts`, `suite/app/layout.tsx`, `suite/app/(app)/login/page.tsx`, `suite/lib/support.ts`, `.github/FUNDING.yml`, `suite/lib/blog/posts.ts`, `suite/app/sitemap.ts`, `suite/.env.example` | Section 4 |
| Viewed | `hero-overview.png` (one of 24 framed images) | Section 3 |

**Not reviewed:** the other 23 images, the 3 clips (described from `assets/README.md`, not watched), the 34 dated specs and plans other than those named above, and the live site (I did not open `trousseau-suite.vercel.app`). Statements about the live site are inferred from the code.

---

## 2. Current asset inventory

State key: **Usable** = ship as is or with a line edit · **Draft** = right idea, needs work · **Overhaul** = start again · **Missing** = does not exist.

### 2.1 Strategy and positioning

| Asset | Location | State | Notes |
| --- | --- | --- | --- |
| Growth strategy | `marketing/STRATEGY.md` | **Usable** (as a base) | Positioning line, evidence table, three audiences, channel sequence, pre-launch checklist, "claims left out" table. Metrics table has no targets by design. |
| Product vision and decisions log | `docs/PRODUCT-ROADMAP.md` | **Usable** | The source of truth for "free forever". Not a marketing document, but every claim traces to it. |
| Contributor roadmap | `ROADMAP.md` | **Usable** | Clear ✅/🔜/💭/🚫 structure. The "not planned, on purpose" list is a marketing asset in its own right. |
| Original consolidation brief | `scratch/PRD.md` | **Overhaul / archive** | A pasted AI chat reply naming the product "Tableaux Suite", with a different stack and palette. Superseded. It sits in a public repo and confuses the story. |

### 2.2 Copy

| Asset | Location | State | Notes |
| --- | --- | --- | --- |
| Show HN post, 4 titles, 7 prepared replies | `marketing/copy/hacker-news.md` | **Usable** | The strongest piece. One factual fix needed (sign-in, section 4). |
| Reddit: r/selfhosted | `marketing/copy/reddit-posts.md` §1 | **Usable** | Answers the Docker question before it is asked. |
| Reddit: r/WeddingsUnder10k | same, §2 | **Draft** | Good voice, but it is a feature list. It leads with the maker, not the reader's problem. UK units and £ in a mostly US subreddit. |
| Reddit: r/opensource, r/webdev | same, §3 | **Usable** | The four "lessons" are real and specific. |
| X thread (7 parts) | `marketing/copy/social-media.md` §1 | **Usable** | One thread only. Builder audience only. |
| LinkedIn | same | **Draft** | It is the X thread with the numbers removed. No post written for LinkedIn's audience. |
| Short video scripts (3) | same, §2 | **Usable** | Shot lists with timings. Not filmed. |
| Mastodon, Bluesky one-liners | same, §3 | **Usable** | |
| Product Hunt copy | — | **Missing** | |
| Email: outreach | — | **Missing** | |
| Email: welcome and onboarding | — | **Missing**, and blocked (section 6, gap G7) |
| Press kit, one-pager, founder bio | — | **Missing** | |

### 2.3 Web

| Asset | Location | State | Notes |
| --- | --- | --- | --- |
| Marketing landing page | `marketing/landing-page/index.html` (35 kB, single file) | **Draft** | Complete page with three working mini-demos, comparison table, pledge, self-host block. **Not deployed** (it is an unticked item in the strategy checklist). No FAQ, no social proof, no planner section. `og:image` is a relative path (section 4, F4). |
| In-app welcome | `suite/components/shell/FrontPage` → `Welcome` | **Usable** | What a first-time visitor to the hosted app actually sees. Not audited line by line. |
| Blog | `suite/lib/blog/posts.ts` | **Draft** | 4 guides, all published 2026-09-29, all England-and-Wales topics (drink quantities, giving notice, civil ceremony music, packing). Each links to a tool. No post targets the highest-intent searches (seating chart, place cards, timeline). |
| "Share your story" page | `suite/app/blog/share` | **Usable** | A ready-made, consent-first route to testimonials. Nothing has come through it yet. |
| Support page (Ko-fi) | `suite/app/support` | **Usable** | |
| Privacy and terms | `suite/lib/legal.ts` | **Usable** | Precise, and digest-tested. Constrains what marketing may do with email (G7). |
| Open Graph, sitemap, robots | `suite/app/*` | **Usable** | Tools are deliberately out of the sitemap. Root meta description still says "Seating, stationery, timeline and crew … entirely on your own device", which predates accounts and seven of the tools. |

### 2.4 Media kit

| Asset | Count | State | Notes |
| --- | --- | --- | --- |
| Framed hero images, 1600×1000 | 13 | **Usable** | One per tool plus overview. |
| Square carousel cards, 1080×1080 | 6 + pledge | **Usable** | |
| Social preview 1280×640, OG card 1200×630, story 1080×1920, tools grid, binder trio | 5 | **Usable** | |
| Clips (GIF + MP4): seat-to-card, ceremony-moves, binder | 3 | **Usable** | 17–20 s, captioned, frame-accurate. |
| Raw screenshots at 2× | 21 | **Usable** | |
| Regeneration pipeline | `marketing/assets/pipeline/` | **Usable** | About fifteen minutes to rebuild everything after a UI change. Rare, and valuable. |
| Product Hunt gallery (1270×760), thumbnail (240×240) | — | **Missing** | Pipeline can produce them. |
| Logo files, wordmark, brand colours sheet | — | **Missing** | Only `suite/app/icon.svg` (547 bytes). |
| Founder photo | — | **Missing** | Needed for Product Hunt, LinkedIn and press. |

---

## 3. Strengths and weaknesses

### 3.1 Messaging

| | Assessment |
| --- | --- |
| ✅ | **One demonstrable idea.** "Seat your guests and one click puts every table number on the place cards. Move the ceremony and the day moves with it." It is concrete, visual, and repeated word for word across README, landing page, HN, Reddit and X. |
| ✅ | **The origin line is excellent.** "Two apps disagreed about what day the wedding was." It is true, short and funny. |
| ✅ | **Honesty as a feature.** "Encrypted at rest, not end to end", "no Docker image, on purpose", "it doesn't do RSVPs". This disarms the two most hostile launch audiences (HN, r/selfhosted). |
| ✅ | **The strategy explicitly forbids eight unsupported claims** and says what to say instead. Few projects have this. |
| ⚠️ | **Every piece leads with what it is, not what the reader gets.** Couples do not want "eleven tools sharing one document". They want "nobody is at the wrong table and nothing gets retyped the week before". The mechanism is the developer hook; the outcome is the couple hook. Only the video scripts get this right. |
| ⚠️ | **"Free" is doing too much work.** The biggest competitors are also free at the point of use, and the strategy admits it. The differentiator is *why* it is free and *what that changes for the user*, which the landing page comparison table handles well but the couple-facing Reddit post buries. |
| ⚠️ | **Privacy is pitched to people who did not ask.** For self-hosters it is the headline. For couples it is a reason to trust, not a reason to try. |
| ❌ | **No message for planners at all**, although planner mode, a reusable library and supplier links are built. |

### 3.2 Positioning

| | Assessment |
| --- | --- |
| ✅ | Clear category ("wedding planner") and a clear enemy ("free" apps funded by vendor leads, registries and upsells). |
| ✅ | Says what it is not (RSVPs, wedding website, vendor directory) and names a companion (Joy). Positions as *complement*, which lowers switching cost. |
| ⚠️ | **Three audiences, no ranking.** DIY couples, self-hosters, contributors. The channel plan is ordered developer-first, which optimises for stars. Nothing says which audience the launch is *for*. |
| ⚠️ | **Geography undecided.** The product is UK-built (£, UK alcohol units, "licence", blog posts on English and Welsh marriage law, `en_GB` locale). The channels chosen are mostly US (HN at 8–10am Eastern, r/WeddingsUnder10k). Neither is wrong; choosing neither is. |
| ❌ | **No competitor named or analysed.** The strategy says "typical commercial wedding app". It does not mention the paid seating tools Knotwork replaces outright, nor the one other AGPL wedding planner (section 5 of `02_GTM_STRATEGY_FOUNDATION.md`). |

### 3.3 Tone and voice

| | Assessment |
| --- | --- |
| ✅ | Consistent, plain, British, first person, dry. Short sentences. No superlatives. It sounds like one person, which it is. |
| ✅ | The landing page's pledge section ("Counting pages, not people") is the best writing in the folder. |
| ⚠️ | Couple-facing copy is slightly too restrained. It never says how the week before a wedding *feels*. The video scripts ("venues never have signal") show the voice can do warmth without hype. |
| ⚠️ | Emoji as bullet icons throughout README and Reddit copy. Fine on GitHub; reads as promotional on Reddit. |

### 3.4 Visual and copy consistency

| # | Inconsistency | Where | Severity |
| --- | --- | --- | --- |
| C1 | **Three names in public view.** Product is *Knotwork*; repo is `JFrusher/Trousseau`; live URL is `trousseau-suite.vercel.app`, and it is burned into the browser frame of every hero image. Clone command is `git clone …/Trousseau.git Knotwork`. | README, all copy, 13+ images | **High** |
| C2 | **Internal codenames leak.** Tableaux, Plaque, Cadence, Brigade, Ensemble appear in route components, token class names, the bug backlog template and `scratch/PRD.md`. | Repo | Low (developers only) |
| C3 | **"Formerly Trousseau"** in the README, with no explanation of why, next to a repo still called Trousseau. | README | Medium |
| C4 | **Six tools "from the start" vs five "on by default".** Both are right (Guests is always on, five default tools, six optional = eleven plus Guests), but README says "eleven tools" while listing twelve rows. | README, STRATEGY | Low |
| C5 | **Root meta description is stale** ("Seating, stationery, timeline and crew … entirely on your own device"). | `suite/app/layout.tsx` | Medium (it is what Google and link previews show) |
| C6 | **Visual identity is strong and consistent** (Marcellus + Lato, warm off-white, gold accent, the same example wedding everywhere). No issue; listed so it is not disturbed. | Media kit | — |

---

## 4. Claim check: copy against code

Rule used: a claim stays only if a file proves it. Four findings.

| # | Claim in copy | What the code says | Evidence | Action |
| --- | --- | --- | --- | --- |
| F1 | "Magic-link sign-in" / "sign in with your email and you get a link" (README, STRATEGY, ROADMAP, HN, Reddit) | Sign-in is a **six-digit emailed code**, plus **Continue with Google** and **Continue with Apple**. | `suite/app/(app)/login/page.tsx` lines 30–41, 140 (`verifyOtp`); `suite/lib/legal.ts` line 64 | **Fix before launch.** Say "no password: a six-digit code by email, or Google or Apple". HN will check. |
| F2 | "No social login" (PRODUCT-ROADMAP decision, 2026-09-02) | Google and Apple sign-in exist. | same | Update the decisions log so the repo does not contradict itself. |
| F3 | "Over 1,800 test cases across 230+ test files" | 265 files match `*.test.*` or `*.spec.*` in the listing. The case count was not re-run. | Folder listing | "230+" is safe. Re-run the count on launch morning and use the real number. |
| F4 | Landing page `og:image` = `../assets/images/og-card.png` | Open Graph images must be absolute URLs. A relative path will not unfurl on X, LinkedIn, Slack or iMessage. | `marketing/landing-page/index.html` `<meta property="og:image">` | Make it absolute when the page is deployed. This silently kills every shared link's preview. |

Claims checked and **confirmed**: Ko-fi exists (`.github/FUNDING.yml`, `suite/lib/support.ts`); analytics render only on Vercel (`layout.tsx`: `onVercel() ? <PageCounts/>`); Sentry only with a DSN (`.env.example`); eleven tool IDs (`tools.ts`); no Dockerfile in the listing; blog has four posts.

---

## 5. What a launch needs, and whether it exists

| Launch requirement | Exists? | Where / gap ref |
| --- | --- | --- |
| Positioning line | ✅ | `STRATEGY.md` |
| Ranked ICPs with triggers and decision criteria | ❌ | G1 |
| Competitor analysis | ❌ | G2 |
| Pricing and packaging | ✅ decided (free forever) · ❌ sustainability message | G3 |
| Deployed landing page on a matching domain | ❌ | G4 |
| Conversion funnel definition | ❌ | G5 |
| Activation definition and a way to measure it | ❌ | G6 |
| Onboarding sequence | ✅ in-app tour · ❌ email | G7 |
| Social proof | ❌ | G8 |
| Channel strategy with prioritisation | ⚠️ sequence only, no scoring | G9 |
| Launch-day runbook | ⚠️ checklist only | G9 |
| KPIs with targets | ❌ (blank by design) | G10 |
| Feedback loop from users | ❌ | G11 |
| SEO plan | ⚠️ four posts, no keyword plan | G12 |
| Press and partner outreach | ❌ | G13 |
| Retention plan | ❌ | G14 |

---

## 6. Critical strategic gaps

Ordered by how much each blocks a launch.

### G1 · No primary audience (blocks everything)

Three audiences are described; none is chosen. They want different headlines, different channels and different weeks. **Developers launch a repo. Couples launch a product.** Planners are not addressed at all, although they are the only audience that returns every season and brings many weddings each.

*Fix:* `02_GTM_STRATEGY_FOUNDATION.md` §1 ranks three ICPs and assigns each a job in the launch.

### G2 · No competitor map

"Typical commercial wedding app" is a fair public framing but not a strategy. Missing: which paid tools Knotwork replaces outright, which free tools it sits beside, and the existing open-source alternative.

*Fix:* `02` §3.

### G3 · "Free forever" has no sustainability story

The decision is made and is the reason the project exists, so there is no pricing to design. But "what's the catch?" is the first question from every couple and "what happens when you get bored?" is the first from every self-hoster. The Ko-fi and the 24-month retention sweep are the real answers and neither is in the main copy.

*Fix:* `02` §4.

### G4 · No front door (high)

- The landing page is not deployed.
- The only public URL is `trousseau-suite.vercel.app`: wrong name, a `vercel.app` subdomain, and it is printed inside every hero image.
- GitHub repo is `Trousseau`.

A couple who hears "Knotwork" and searches for it cannot find it. This is the single highest-value fix and costs roughly the price of a domain.

*Fix:* register a domain, point it at the Vercel project, rename the repo (GitHub redirects the old URL), regenerate the images with the pipeline.

### G5 · No funnel

Nothing defines the steps between a visit and a planned wedding, so nothing can be improved. The README's "Get started in two minutes" is the funnel in disguise: open → Data (names, venue, date) → import guests → drag tables.

*Fix:* `03_LAUNCH_EXECUTION_PLAYBOOK.md` §3.

### G6 · Activation cannot currently be measured, by design

The privacy promises rule out the usual tools. What *can* be counted without breaking them:

| Signal | Source | Covers |
| --- | --- | --- |
| Page visits by route, referrer, country | Vercel Web Analytics (cookieless, route-only) | Everyone on the hosted site |
| Weddings created | Supabase `account_weddings` row count | Account holders only |
| Stars, forks, clones, referrers | GitHub Insights | Developers |
| npm downloads of `@jfrusher/knotwork` | npm | Integrators |

**Local-only users, the default and most private path, are invisible after the first page.** Route counts for `/seating`, `/place-cards` and `/timeline` are the only proxy for activation. That is a constraint to state openly, not to work around.

*Fix:* `03` §3 builds the KPI set from these four sources only.

### G7 · Email onboarding is blocked by the privacy policy (must decide)

The requested welcome sequence cannot be sent as things stand:

- People who use Knotwork without an account give no email address at all.
- People with an account give one **for sign-in only**. The Privacy Policy says an account "stores your email address" so partners can plan on separate devices. Nothing mentions updates or tips.
- Under UK PECR, marketing email to individuals needs consent or the narrow soft opt-in, and sending onboarding tips to sign-in addresses would contradict "your guests are not the product" in spirit even if a lawyer allowed it.

*Options:* (a) an explicit, unticked "send me four short emails on getting set up" box at sign-in, with a policy update and a sending service added to the list of processors; or (b) no email at all, and the same four messages delivered in the app's front page "Next" card. **Recommendation: (b) first, (a) only if asked for.** The sequence in `assets/email-sequences.md` is written so it works as either.

This is a decision for you, not one I should assume.

### G8 · No social proof

No testimonial, no usage number, no press mention, no star count worth quoting. The one true proof point, that a real wedding was planned with it, is in the README's last section and nowhere on the landing page.

*Fix:* lead with the real wedding; collect quotes through the existing `/blog/share` route; add proof after launch (stars, a named HN comment), never before.

### G9 · Channel plan is a sequence, not a prioritisation

Eight channels in a week-by-week table, no scoring, no kill criteria, and no answer to "what if Hacker News does nothing?". Couple channels arrive in week 2 as an afterthought. Product Hunt, UK wedding communities, planner communities, awesome-selfhosted and directory listings are absent or unscheduled.

*Fix:* `03` §2, with ICE scores.

### G10 · No targets

Targets were left blank "on purpose" until baselines exist. Reasonable for stars, but it means there is no definition of a successful launch and no trigger for changing course.

*Fix:* `03` §3 gives assumption-labelled ranges and the decision each one triggers.

### G11 · No feedback loop

GitHub Issues is the only inbound route, and couples do not have GitHub accounts. GitHub Discussions is not yet enabled. There is an email address in the privacy policy and nothing inviting its use.

*Fix:* a plain "Tell me what's missing" mailto in the app footer and in every couple-facing post; Discussions for developers.

### G12 · SEO is started but unaimed

Four guides, all on one day, all UK-legal or logistics topics with modest search demand. The blog's own doc comment says it "is there to be found", but no post targets the queries the product answers best. The roadmap already lists "public calculator pages" as deferred; the drinks calculator is the obvious first.

*Fix:* `03` §2.4.

### G13 · No outreach

No list of wedding bloggers, budget-wedding newsletters, UK planners' groups, open-source newsletters or podcast hosts, and no email to send them.

*Fix:* `assets/email-sequences.md` Part A.

### G14 · Retention is undefined, and unusual here

A wedding is a one-time event. Retention for a couple means "came back in the last fortnight before the day and printed something", not monthly active use. For planners it means a second wedding. Nothing in the folder says this.

*Fix:* `03` §3.

### G15 · Launch timing ignores the wedding calendar (assumption, see below)

The channel table is dated in "weeks" from an unstated start. It is now October. Developer audiences do not care about season; couples do.

*Fix:* `03` §1 splits the launch in two: developers now, couples in January.

---

## 7. Assumptions made

Stated so you can correct any of them. Each one changes something downstream.

| # | Assumption | Basis | If wrong |
| --- | --- | --- | --- |
| A1 | **Budget is £0 beyond a domain.** No paid ads, no paid tools. | "Free forever", personal project, Ko-fi only. | Paid channels in `03` §2 stay at the bottom of the ICE table either way. |
| A2 | **One maintainer, evenings and weekends**, alongside a job and a degree. | Privacy policy: "a personal project, not a company". | The roadmap in `03` is sized for about 6–8 hours a week. |
| A3 | **Primary market is the UK**, with English-speaking developers worldwide as the launch amplifier. | £, UK units, `en_GB`, England-and-Wales blog posts, ICO named as regulator. | Swap r/UKweddings for US subs and rewrite the bar and money examples. |
| A4 | **Launch has not happened.** No post has gone out. | Unticked checklist; no baselines recorded. | Skip T-2 and go straight to the couple wave. |
| A5 | **A domain will be bought and the repo renamed before launch.** Copy uses `knotwork.app` as a **placeholder**. I did not check that it is available. | G4. | Replace the placeholder everywhere; the copy does not otherwise depend on it. |
| A6 | **Goal of the launch is weddings planned, not stars.** Stars are a means. | "Built for other couples" (README). | If the goal is contributors, reorder the ICPs. |
| A7 | **UK engagements cluster between Christmas and Valentine's Day**, so couple demand rises in January. | Widely reported in the wedding trade; **I did not verify it with a source in this session.** | The two-wave split still holds; only the date of wave two moves. |
| A8 | **The personal story in the copy is accurate** (married, two apps disagreed on the date, built for own wedding). | README, repeated in all copy. | Yours to confirm. `reddit-posts.md` already warns that one embellished detail undoes a post. |

---

## 8. What to do before anything is posted

In order. Items 1–4 are the gate.

| # | Action | Fixes | Effort |
| --- | --- | --- | --- |
| 1 | Buy a domain, point it at Vercel, set `siteUrl`, rename repo to `Knotwork` | G4, C1, C3 | 1 evening |
| 2 | Correct the sign-in claim everywhere ("six-digit code, or Google or Apple") | F1, F2 | 30 min |
| 3 | Regenerate images so the browser frame shows the new domain | C1 | 15 min (pipeline) |
| 4 | Deploy the landing page with an absolute `og:image`; test the unfurl | F4, G4 | 1 hour |
| 5 | Update root meta description in `layout.tsx` | C5 | 5 min |
| 6 | Move `scratch/PRD.md` out of the public repo, or add a one-line "historical" header | 2.1 | 5 min |
| 7 | Finish the unticked items in `STRATEGY.md`'s checklist (topics, social preview, Discussions, private vulnerability reporting, good-first-issues) | G11 | 1 evening |
| 8 | Decide G7 (email or in-app) | G7 | A decision |
| 9 | Add a "Tell me what's missing" mailto to the app footer | G11 | 15 min |

Next: `02_GTM_STRATEGY_FOUNDATION.md`.

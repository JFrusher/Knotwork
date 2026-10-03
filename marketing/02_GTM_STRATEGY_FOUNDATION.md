# 02 · GTM strategy foundation: Knotwork

Written: 3 October 2026 · Builds on `01_MARKETING_AUDIT_REPORT.md` and `marketing/STRATEGY.md` · Research: web, 3 October 2026, sources at the end.

**Confidence key used throughout:** ✅ verified this session (in the code or at a primary source) · 🟡 from one secondary source, check before quoting publicly · ⚪ my judgement or assumption.

---

## 0. The strategy in six lines

1. **Who it is for:** UK couples planning their own wedding, without a paid planner, who have reached the seating chart. ⚪
2. **What it replaces:** the spreadsheet, the paid seating tool, the place-card typesetting and the run sheet. Not the RSVP site.
3. **Why they believe it:** a real wedding was planned with it, the code is public, and there is nothing to buy.
4. **How they hear:** developers first (they amplify and they audit the privacy claims), couples second, in January, through search and communities.
5. **What it costs them:** nothing, ever. What it costs you: a domain and about £0–20 a month. ⚪
6. **What success is:** weddings planned to the point of printing something. Not stars.

---

## 1. Ideal customer profiles

Ranked. The rank decides the headline on the landing page and the order of the launch.

| Rank | ICP | Role in the launch | Why this rank |
| --- | --- | --- | --- |
| 1 | **The DIY couple** | The user. Everything is built for them. | The product's reason to exist. Largest group. Hardest to reach. |
| 2 | **The technical partner / self-hoster** | The amplifier and the auditor. | Easiest to reach in week one. They star, share, and verify the privacy claims so couples do not have to. Many are also ICP 1. |
| 3 | **The independent planner or day-of coordinator** | The multiplier. | Smallest group, but each brings several weddings a year and returns every season. Planner mode is built and unannounced. |

Open-source contributors, the third audience in the existing strategy, are folded into ICP 2: same channels, same message, and a contributor almost always arrives as a user first.

### ICP 1 · "Spreadsheet Sophie": the DIY couple

| | |
| --- | --- |
| **Who** | Engaged, UK, planning it themselves. Venue and caterer booked. No planner. One partner runs "the spreadsheet". 60–120 guests. ⚪ |
| **Context** | The average UK wedding costs about £21,990 (£272 a guest), and 56% of couples went over budget in 2025 (Hitched, 2,020 newlyweds, Jan 2026). ✅ Bridebook's 2026 figure is £20,604. ✅ Every pound is watched. |
| **Already uses** | Google Sheets or Excel for guests. A free platform (Bridebook, Hitched, Joy, Zola or The Knot) for RSVPs or a website. Pinterest. A group chat. Canva for stationery. ⚪ |
| **Core pains** | 1. The guest list exists in three places and they disagree. 2. One late RSVP means re-doing the seating chart, then the place cards, then the caterer's dietary sheet. 3. The run of the day lives in one person's head. 4. "Free" apps keep steering them to suppliers and paid stationery. 5. Nobody else knows the plan if that person is busy getting married. |
| **Triggers** | RSVPs close (about 6–8 weeks out). The venue asks for a table plan and dietary list. A stationer quotes for place cards. A supplier asks "what time do you need me?". The first family argument about who sits where. ⚪ |
| **Where they are** | r/UKweddings (about 40k) 🟡, r/weddingplanning (about 1.6M, mostly US) 🟡, r/WeddingsUnder10k, Hitched and Bridebook forums, Facebook groups for their venue or region, wedding TikTok and Instagram, Pinterest, and Google at 11pm ("wedding seating chart template", "how much wine for 100 guests"). |
| **Decision criteria** | 1. Can I try it without signing up? 2. Will it take the guest list I already have? 3. Does it look good enough to show my partner? 4. Can I print from it? 5. What's the catch? |
| **Objections** | "I already have a spreadsheet." "I'm not technical." "Will it still exist on my wedding day?" "Does it work on my phone?" (planning is desktop; the Binder is phone). |
| **Message** | *One guest list. Seat them once, and the place cards, dietary counts and run sheet already know.* |
| **Proof they need** | The 17-second seat-to-card clip. The words "no sign-up". Another couple saying it worked. |
| **Do not say** | "Local-first", "AGPL", "JSON document", "slice". |

### ICP 2 · "Self-host Sam": the technical partner

| | |
| --- | --- |
| **Who** | Developer, sysadmin or homelabber who is engaged, or whose sibling or friend is. Runs Immich, Jellyfin or Home Assistant. Reads Hacker News. |
| **Core pains** | 1. A guest list is names, emails, family relationships and dietary needs that can be health data, sitting on a platform whose business is vendor leads. 2. Wedding software is closed and cannot be exported. 3. They have already half-built a script for seating and abandoned it. |
| **Triggers** | Their partner signs up to a wedding platform and the marketing email starts. A Show HN. A post on r/selfhosted. Being asked "can you make a seating chart thing?". |
| **Where they are** | Hacker News, r/selfhosted, r/homelab, r/opensource, r/webdev, r/nextjs, Lobsters, Mastodon (#selfhosted), awesome-selfhosted, GitHub trending, open-source newsletters. |
| **Decision criteria** | 1. Licence. 2. Can I read the privacy claims in the code? 3. How hard is the install, and is there Docker? 4. Is it maintained or a weekend project? 5. Can I get my data out? |
| **Objections** | "No Docker." "Needs Supabase." "Half the commits are AI." "Not end-to-end encrypted." "Why not CRDTs?" The existing HN copy answers all five. ✅ |
| **Message** | *Local-first wedding planner. One document, eleven tools, AGPL. No account, and nothing leaves the browser unless you turn sync on.* |
| **Proof they need** | The repo. The merge rule. The test suite. The "claims deliberately left out" table. |
| **Second job** | They are the bridge to ICP 1. Every piece of developer copy should end with: *planning a wedding, or know someone who is? Send them the link.* |

### ICP 3 · "Coordinator Kate": the independent planner

| | |
| --- | --- |
| **Who** | Solo planner, on-the-day coordinator or venue coordinator. 5–25 weddings a year. Also: the organised friend or parent who is unofficially running the day. ⚪ |
| **Already uses** | Word and Excel templates, Canva, WhatsApp. Sometimes a paid suite: Aisle Planner is listed at $39.99 a month 🟡; PerfectTablePlan Professional is $299.95 one-off ✅. |
| **Core pains** | 1. Rebuilding the same run sheet, packing list and processional for every client. 2. Getting the couple's guest list in a usable shape. 3. Chasing supplier confirmations. 4. Software subscriptions through the quiet months. 5. No signal at the venue. |
| **Triggers** | A new booking. Start of season. A subscription renewal email. A couple saying "we've been using this thing called Knotwork". |
| **Where they are** | UK planner Facebook groups, Instagram, the UK Alliance of Wedding Planners and similar bodies, r/WeddingVendors, venue open days. ⚪ |
| **Decision criteria** | 1. Many weddings in one account. 2. Do clients need to install or pay for anything? 3. Does the printed output look professional? 4. Can suppliers confirm without a login? 5. Will it be there next season? |
| **Objections** | "Free means unsupported." "My couples aren't technical." "One planner per wedding" (true today; agency teams are on the 💭 list). |
| **Message** | *A run sheet that re-times itself, supplier links that confirm, and a library so you never rebuild a processional. Free for every wedding you run.* |
| **Proof they need** | The PDF pack. The supplier link. A fellow planner's name. |
| **Honest limits** | One planner per wedding. Editing is desktop-only. No client billing, contracts or CRM. Say so: it sits beside their CRM, it does not replace it. ✅ (ROADMAP) |

---

## 2. Core positioning and value proposition

### 2.1 Positioning statement (internal)

> For couples planning their own wedding, **Knotwork** is the free planning suite where the guest list, the room, the stationery and the day are one plan, not five copies. Unlike the big free wedding platforms, it is not paid for by suppliers, registries or upsells, so there is nothing to sell you and nothing to sign up for.

### 2.2 One-line elevator pitches

One per audience. Same product, same truth, different door.

| Audience | Line |
| --- | --- |
| **Default / couples** | **Plan the whole wedding in one place: seat your guests once, and the place cards, dietary counts and run sheet already know.** |
| Developers | An open-source, local-first wedding planner where eleven tools share one document. |
| Planners | The run sheet, seating and supplier confirmations for every wedding you run, free, with a library you build once. |
| Ten words | Free wedding planning tools that agree with each other. |

The existing line in `STRATEGY.md` is kept as the *demonstration* ("seat your guests and one click puts every table number on the place cards; move the ceremony and the whole day moves with it"). It is the best sentence in the project. It moves from headline to sub-headline for couples because it describes the mechanism, and the headline should describe the relief.

### 2.3 Primary value proposition

> **Change it once.** One guest list feeds the seating plan, the place cards, the photo list and the run of the day, so a late RSVP is one edit, not an evening.

### 2.4 Three supporting pillars

| Pillar | Promise | Proof in the product ✅ | Lead with it for |
| --- | --- | --- | --- |
| **1. One plan, not five copies** | Nothing is retyped and nothing disagrees. | Seating → place cards (*Use the room*). Timeline → delegation (move the ceremony, jobs move). Seven cross-tool checks: two dates, a seat with two people, a table over capacity, confirmed guests with no table or dietary answer. | Couples, planners |
| **2. Free, with nothing to sell you** | No paid tier, no adverts, no supplier leads, no upsell to printed stationery. Not now, not later. | No billing code exists. AGPL on the app stops a closed paid fork. Decision logged as "load-bearing" in `PRODUCT-ROADMAP.md`. Tips via Ko-fi unlock nothing. | Couples |
| **3. Yours** | Start without an account. Keep it on your own device. Take it with you as one file. Run your own copy. | IndexedDB with no account. *Download my wedding* → `.knotwork.json`. MIT data contract on npm. Self-hosting runbook tested on a fresh clone. No analytics off Vercel. | Self-hosters, and as reassurance for couples |

**Supporting, not a pillar: "ready for the day".** The Binder (offline, on a phone), the one-PDF pack, guest seat links and supplier links. This is the retention story (§5 of the playbook) and the strongest planner hook.

### 2.5 Unique selling proposition

> **The only wedding planner that is free with no business model behind it, and where the tools share one plan.** Open source, so both halves can be checked.

Each word in that is doing work, and each is defensible:

| Claim | Against whom | Holds because |
| --- | --- | --- |
| "Free with no business model" | Bridebook, Hitched, The Knot, WeddingWire, Zola, Joy | They are free at the point of use and funded by supplier listings, referrals and registries. 🟡 Knotwork has no revenue line at all. ✅ |
| "Tools share one plan" | The same platforms, and spreadsheets | Their seating, guest list and timeline are separate features. ⚪ Knotwork's cross-tool checks are in the code. ✅ |
| "Open source" | Everyone except LibreWeddingPlanner | AGPL-3.0-or-later. ✅ |
| "Only" | LibreWeddingPlanner | It is also free and AGPL. From the one description found, it covers guests and expenses; I found no evidence of seating to scale, place cards, a timeline resolver or a day-of binder. 🟡 **Verify by reading its repo before using the word "only" in public.** Until then say "the open-source wedding planner where…", which is safe. |

### 2.6 Message hierarchy

| Level | Couples | Developers | Planners |
| --- | --- | --- | --- |
| Hook | "Two of our wedding apps disagreed about the date." | same | "Stop rebuilding the same run sheet." |
| Promise | Change it once. | One document, one owner per slice. | A library you build once. |
| Demo | Seat a guest → her card has her table. | The merge rule; the resolver. | Move the ceremony → every supplier's time moves. |
| Trust | No sign-up. Nothing to buy. A real wedding used it. | AGPL. Tests. Honest limits. | The PDF pack. Supplier confirmation. |
| Ask | Open it and import your guest list. | Tear the design apart. Star it. | Try it on your next wedding. |

### 2.7 Vocabulary

| Say | Not |
| --- | --- |
| "no sign-up to start" | "local-first" (couples) |
| "no password: a six-digit code by email, or Google or Apple" | "magic link" (not what the code does) |
| "stays on your device unless you turn on sync" | "zero tracking", "end-to-end encrypted" |
| "imports your RSVPs from Joy, Zola, The Knot or a spreadsheet" | "RSVP tracking" |
| "keep-together and keep-apart rules, with warnings" | "automatic seating" |
| "runs anywhere Node 20 does" | "Docker" |
| "nothing to buy" | "save £X" (no verified figure) |

The last four rows restate `STRATEGY.md`'s "claims deliberately left out". They still hold.

---

## 3. Market and competitors

### 3.1 The shape of the market

Four groups. Knotwork overlaps each a little and none completely.

| Group | Examples | Price to the couple | How it is paid for | Overlap with Knotwork |
| --- | --- | --- | --- | --- |
| **A. Free planning platforms** | Bridebook, Hitched, The Knot, WeddingWire, Zola, Joy | Free | Supplier listings and referrals, registry commissions, paid extras 🟡 | Guest list, checklist, budget, seating |
| **B. Paid seating and stationery tools** | PerfectTablePlan, TopTablePlanner, Prismm (formerly AllSeated), stationers | $30–$300 one-off, or per card | The buyer | Seating, place cards |
| **C. Professional planner suites** | Aisle Planner, Planning Pod, HoneyBook | About $40 a month and up 🟡 | The planner | Timeline, supplier management, checklists |
| **D. Do it yourself** | Google Sheets, Excel, Canva, Word | Free | — | All of it, badly |
| **E. Open source** | LibreWeddingPlanner | Free | Nobody | Guests, expenses |

**The real competitor is D.** Most couples in ICP 1 are not choosing between Knotwork and Zola. They are choosing between Knotwork and the spreadsheet they already have. The pitch has to beat "it's fine, I'll just copy the names across".

### 3.2 Competitor detail

| Competitor | What it is | Price | Notable limits | Confidence |
| --- | --- | --- | --- | --- |
| **Bridebook** | UK's self-described no. 1 planning app: budget, guests, checklist, supplier discovery | "Completely free" for couples, by its own support page | UK and EU supplier focus; revenue model not stated on that page; a secondary source reports premium upsells | ✅ price · 🟡 model |
| **Hitched** | UK platform, part of The Knot Worldwide | Free | Supplier marketplace model | 🟡 |
| **The Knot / WeddingWire** | US platforms sharing a supplier database | Free | Supplier referrals; one source says the wedding site is removed a year after the date | 🟡 |
| **Zola** | US registry-led platform | Free core | One source reports seating is iOS-only with a $14.99 unlock past 15 guests. **Single secondary source: do not quote publicly.** | 🟡 |
| **Joy** | Wedding website and RSVPs | Free core | Limited seating; no supplier directory. **Knotwork's stated companion, not a rival.** | 🟡 |
| **PerfectTablePlan** | Desktop seating software, with an auto-assign solver | $29.95 Home · $74.95 Advanced · $299.95 Professional, one-off | Desktop install; seating only | ✅ (vendor page) |
| **Aisle Planner** | Planner business suite | $39.99 a month entry, free trial | For professionals; subscription | 🟡 (Capterra) |
| **LibreWeddingPlanner** | AGPL, self-hostable; guests and expenses; hosted on Codeberg; built for the makers' own wedding | Free, no donations taken | An r/opensource post in Dec 2025 drew 15 points. Small. | 🟡 |
| **A spreadsheet** | — | Free | No floor plan, no printing, no checks, one person can read it | ✅ |

### 3.3 Where Knotwork wins, and where it loses

| | Knotwork | Free platforms (A) | Paid seating (B) | Spreadsheet (D) |
| --- | --- | --- | --- | --- |
| Seating to scale with rules | ✅ | Basic, varies | ✅ | ❌ |
| Place cards filled from seating | ✅ | Sold as stationery ⚪ | Some | Mail merge |
| Timeline that re-times itself | ✅ | Checklist only ⚪ | ❌ | ❌ |
| Jobs, photo list, boxes, bar | ✅ | ❌ | ❌ | DIY |
| Offline day-of phone view | ✅ | App, needs signal ⚪ | ❌ | ❌ |
| No account needed | ✅ | ❌ | n/a | ✅ |
| Export everything | ✅ one file | Varies | ✅ | ✅ |
| **RSVP collection** | ❌ imports | ✅ | ❌ | ❌ |
| **Wedding website** | ❌ | ✅ | ❌ | ❌ |
| **Supplier directory** | ❌ | ✅ | ❌ | ❌ |
| **Automatic seating** | ❌ | ❌ | ✅ (PerfectTablePlan) | ❌ |
| **Phone editing** | ❌ read-only Binder | ✅ | ❌ | Painful |
| **Native app, brand, support team** | ❌ | ✅ | Some | n/a |

**Conclusion.** Do not fight group A on their ground. The position is: *keep your RSVP site; do the actual planning here.* Against B, Knotwork is free and does more. Against D, the 17-second clip is the whole argument.

### 3.4 Risks

| Risk | Likelihood | Response |
| --- | --- | --- |
| "Free" is not a differentiator because the incumbents are free | High | Lead with "one plan", use "free" as the closer. Explain *why* free. |
| HN or r/selfhosted fixates on AI co-authorship | Medium | Already handled: stated up front, with specs and plans in the repo. Do not hide it. |
| Community rules forbid the post | Medium | **I could not retrieve current rules for r/selfhosted, r/weddingplanning or r/WeddingsUnder10k.** Read each sidebar on the day; message the moderators of wedding subs first. |
| A surge exceeds free hosting tiers | Low–medium | Local-only use costs nothing. Check Supabase and Vercel quotas at T-7. The write path is already rate-limited. ✅ |
| Couples arrive on phones and find a desktop tool | High | Say "plan on a laptop, carry it on your phone" in every couple-facing post. |
| One maintainer | Certain | Self-hosting and the export file are the answer to "what if you stop?". Say it. |
| A "save £X" claim gets challenged | — | None is made. Keep it that way until someone prices real alternatives with dates. |

---

## 4. Pricing and packaging

### 4.1 Evaluation

**There is no pricing to design, and that is correct.** "No paid tier, ever" is the founding decision (`PRODUCT-ROADMAP.md`: "it rules out billing infrastructure as a subsystem entirely") and the central marketing claim. Introducing any paid tier would cost more in trust than it could earn. I am not recommending one.

What does need designing is the **packaging** (how a free product is presented so people believe it) and the **sustainability message** (why it will still be there on their wedding day).

### 4.2 Packaging: three ways in, one product

Present these as *choices about where your wedding lives*, never as tiers. Every tool is in all three.

| | **Just open it** | **Plan together** | **Run your own** |
| --- | --- | --- | --- |
| Price | Free | Free | Free |
| Account | None | Email code, Google or Apple | Your choice |
| Wedding lives | In your browser | Synced, encrypted at rest | On your server |
| Good for | Trying it. One person planning. | Two partners and a planner. Guest and supplier links. | Your own domain. No analytics at all. |
| All eleven tools | ✅ | ✅ | ✅ |
| Costs you | Nothing | Nothing | Hosting, if any |

Rule for the page: **never use the words "plan", "tier", "upgrade" or "Pro".** A three-column table with ticks already looks like a pricing page; the header must say "Three ways to use it. All free. All the same tools."

### 4.3 Sustainability message

The honest answer to "what's the catch?", in order:

1. **It costs very little to run.** A wedding is one small document. With no account it costs nothing at all, because it never leaves your browser. ⚪ (true in kind; no hosting bill was reviewed)
2. **There is a Ko-fi for tips.** A tip unlocks nothing. ✅
3. **The licence means it cannot be made paid later**, by me or by anyone who forks it. ✅
4. **You are not locked in.** One file holds the whole wedding, and you can run your own copy. ✅
5. **Inactive synced weddings are deleted after 24 months**, so the hosted copy does not grow forever. ✅

**Recommended one-off action:** publish the monthly running cost on the Support page once a year ("Hosting cost £X last month. Tips covered £Y."). It turns "free" from a claim into a fact, and it is the most persuasive Ko-fi prompt there is. ⚪

### 4.4 Conversion hooks

"Conversion" here means: visit → open the app → import a guest list. Nobody pays.

| Hook | Use | Where |
| --- | --- | --- |
| **No sign-up. No card. Open it and start.** | Primary CTA microcopy | Hero, final CTA |
| **Bring the guest list you already have.** | Removes the biggest switching cost | Under the hero CTA; FAQ |
| **Look around a finished wedding first.** | For the cautious: the guided tour's 100-guest example | Secondary CTA |
| **Nothing to buy, now or later.** | The closer | Pledge, FAQ |
| **Keep your RSVP site. Plan the rest here.** | Positions beside Joy and Zola, not against | Comparison, FAQ |
| **Built for one real wedding. Now free for yours.** | Proof and origin in nine words | Social proof strip |
| **Plan on your laptop. Carry it on your phone.** | Sets the right device expectation | Binder section |

**Ko-fi ask placement.** Never before value. Three places only: the Support page (exists), the footer (exists), and once after the PDF pack is downloaded ("Glad it helped. If you'd like to, a tip keeps the hosted copy running."). ⚪ Not on the landing page hero, and not in any launch post unless someone asks how it is funded.

### 4.5 What would change this

| If | Then |
| --- | --- |
| Hosting cost passes what tips cover for three months running | Publish the numbers; ask once, plainly. Consider GitHub Sponsors alongside Ko-fi. Still no tier. |
| Planners ask for agency teams, branding on PDFs, or client billing | Build it free or do not build it. A planner tier is the one place a paid plan would be commercially obvious, and it is exactly what the project exists not to do. |
| A company offers to sponsor | Acceptable only with no access to data and no placement in the app. Logo on the README at most. ⚪ |

---

## 5. Decisions this document needs from you

| # | Decision | My recommendation | Affects |
| --- | --- | --- | --- |
| D1 | Primary market: UK or US? | **UK** for couples; global for developers | Subreddits, examples, spelling, launch hours |
| D2 | Domain | Buy one that says Knotwork. `knotwork.app` is a placeholder I have **not** checked for availability. | Every asset |
| D3 | Onboarding by email, or in the app? | **In the app** (audit, G7) | `email-sequences.md` Part B |
| D4 | Use the word "only"? | Not until LibreWeddingPlanner's repo has been read | USP, Product Hunt tagline |
| D5 | Is the personal story accurate as written? | Yours to confirm | All copy |
| D6 | One launch or two waves? | **Two**: developers now, couples in January | Playbook |

---

## Sources

Fetched 3 October 2026.

- [Hitched / The Knot Worldwide: average UK wedding cost 2026, £21,990, 2,020 newlyweds](https://www.theknotww.com/press-releases/the-average-cost-of-a-wedding-in-2026-around-21990-according-to-hitched)
- [Bridebook: the average cost of a UK wedding in 2026 is £20,604](https://bridebook.com/uk/article/how-much-does-a-wedding-cost-the-uk-average)
- [Bridebook support: how much does Bridebook cost](https://support.bridebook.com/en/support/how-much-does-bridebook-cost)
- [PerfectTablePlan: purchase page](https://www.perfecttableplan.com/html/purchase.html)
- [Capterra: Aisle Planner pricing](https://www.capterra.com/p/210290/Aisle-Planner/pricing/)
- [knowledgelib.io: best wedding planning apps (Aug 2026)](https://knowledgelib.io/lifestyle/wedding/wedding-planning-apps/2026): single secondary source for platform business models and the Zola seating figure
- [Gitnux: top wedding seating chart software 2026](https://gitnux.org/best/wedding-seating-chart-software/): product list only, no prices
- [r/opensource snapshot: LibreWeddingPlanner post, Dec 2025](https://reddit.sentinel-team.org/posts/1pq5isb/snapshots/2025-12-20T11%3A11%3A21.68584Z)
- [The Hive Index: r/weddingplanning](https://thehiveindex.com/communities/r-weddingplanning/) · [GummySearch: r/UKweddings](https://gummysearch.com/r/UKweddings/): member counts from third-party trackers
- [Causo: Product Hunt launch 2026, the realistic playbook](https://hub.causo.ai/guides/product-hunt-launch-2026-realistic-playbook)

**Not found:** current posting rules for r/selfhosted, r/weddingplanning and r/WeddingsUnder10k; LibreWeddingPlanner's own repository; any sourced figure for when UK couples get engaged or how many use a planner.

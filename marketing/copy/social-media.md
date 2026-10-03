# Social media

## 1. Build thread: Twitter/X and LinkedIn

Seven parts. On X, post it as a thread. On LinkedIn, join the parts into one
post with a blank line between them, drop the numbering, and put the links in
the first comment (LinkedIn shows posts with outbound links to fewer people).

Attach media to posts 1, 3 and 5. Everything is in `../assets/` (see its
README). Use the example wedding, never real names.

---

**1/7**
> Two of the apps we used to plan our wedding disagreed about what day it
> was.
>
> So I built one where that can't happen, and made it free and open source
> for everyone.
>
> Here's how Knotwork works, and what building it with Claude Code taught
> me 🧵
>
> [Attach: `assets/motion/seat-to-card.mp4`]

**2/7**
> The problem with wedding apps isn't missing features. It's that every
> feature keeps its own copy of your guest list.
>
> Seating chart, place cards, run sheet: three copies of one list, drifting
> apart until the week of the wedding.

**3/7**
> Knotwork is one JSON document per wedding, with 11 tools around it.
>
> The rule: a tool rewrites only its own slice and copies everything else
> byte for byte, even keys from tools that don't exist yet.
>
> Seat people, and one click puts every table number on the cards. Move
> the ceremony and every job after it moves.
>
> [Attach: `assets/motion/ceremony-moves.mp4`]

**4/7**
> Built with Claude Code: about half the commits are co-authored.
>
> What worked was a paper trail. Every subsystem got a dated spec, then a
> plan I approved, then the build. And the plan records where reality
> disagreed with it.
>
> The disagreements are where the bugs were.

**5/7**
> Lessons from those plans:
>
> • A zod looseObject made a renamed field compile silently
> • Our privacy test checked its own wording, so analytics slipped in
>   unnoticed. It now reads the code
> • A security advisor's "fix" would have locked every couple out of their
>   own wedding
>
> [Screenshot: a plan's "what building it found" section]

**6/7**
> What it is today:
>
> 🪑 Seating to scale · 💌 Place cards · 🕒 Timeline with collisions and
> golden hour · 📋 Jobs · 📷 Group shots · 💍 Ceremony · 📦 Boxes · 🍷 Bar ·
> 💷 Money · ✅ Checklist · 📱 Offline phone binder
>
> No account needed. No ads. No paid tier, ever. AGPL, self-hostable.

**7/7**
> If you're planning a wedding: it's free, and your guest list never has to
> leave your laptop → knotwork-suite.vercel.app
>
> If you build things: the code, specs and a guide to adding your own tool
> are on GitHub. A ⭐ helps other couples find it →
> github.com/JFrusher/Knotwork

---

**Hashtags (X, use at most two):** #opensource #buildinpublic
**Hashtags (LinkedIn, at the end):** #OpenSource #TypeScript #NextJS
#Supabase #ClaudeCode #WeddingPlanning

---

## 2. Short-form video scripts (TikTok, Instagram Reels, YouTube Shorts)

Recording notes for all three:

- Record the screen at 1080×1920. Either crop a desktop recording into
  vertical panels, or show the laptop on camera and cut to screen.
- Use the guided tour's example wedding. **Never film a real guest list.**
- Captions burned in, because most people watch muted. Keep each caption
  line under six words.
- End card: "Free · no sign-up · knotwork-suite.vercel.app".
- Don't film on a phone: the planning tools are made for a laptop. Film the
  Binder on the phone in script 3 only.

---

### Script 1: "Seating chart chaos, solved in 30 seconds, for free" (≈30s)

| Time | On screen | Voice-over / caption |
| --- | --- | --- |
| 0–3s | Close-up of a messy printed spreadsheet covered in crossings-out | **Hook:** "If your seating chart looks like this…" |
| 3–7s | Hard cut to Knotwork Seating: an empty room drawn to scale | "Draw your actual room. To scale, so if it doesn't fit here, it won't fit on the day." |
| 7–13s | Drag three round tables in; drag guests onto seats; dietary counts tick up on the right | "Drag people onto seats. It counts the vegetarians for you." |
| 13–18s | Add a "keep apart" rule between two guests, then seat them together: a warning appears | "Uncle and ex-uncle? Tell it to keep them apart. It'll warn you." |
| 18–25s | Open Place cards, press **Use the room**: a sheet of cards appears with table numbers | "Then print your place cards. The table numbers are already on them." |
| 25–30s | End card | "Free. No ads. No sign-up. Link in bio." |

**Caption:** Seating chart done before the kettle boils ☕ Free, no sign-up,
no ads. #weddingplanning #seatingchart #diywedding #weddingtok
#budgetwedding

---

### Script 2: "The ceremony's running late. Watch the whole day fix itself" (≈40s)

| Time | On screen | Voice-over / caption |
| --- | --- | --- |
| 0–3s | Face to camera, or text on black | **Hook:** "Your ceremony just moved 20 minutes. How many things do you have to change?" |
| 3–8s | A paper run sheet with times, being crossed out and rewritten | "Normally? All of them." |
| 8–15s | Knotwork Timeline: lanes for the day, suppliers, transport; the ceremony block is pinned | "In Knotwork, you pin the things with fixed times, and everything else follows." |
| 15–23s | Drag the ceremony 20 minutes later: drinks, photos and speeches slide along; a red collision appears at the curfew | "Move the ceremony and the day moves with it. And it tells you what now runs past the venue's curfew." |
| 23–30s | Mark the drinks reception as squeezable; the collision clears as drinks shrink | "Let the drinks run shorter, and it fixes itself." |
| 30–35s | Open Delegation: jobs show their new times | "Everyone's job sheet updates too." |
| 35–40s | End card | "Free wedding planner. No ads, ever. Link in bio." |

**Caption:** Wedding day timeline that fixes itself when things move ⏰
#weddingtimeline #weddingplanning #weddingday #dayofcoordinator
#weddingtok

---

### Script 3: "What your planner doesn't want you to know: the day in your pocket" (≈35s)

> Tone note: the hook is playful. Don't let the video imply that planners are
> bad, since Knotwork has a planner role and planners are an audience.
> Alternative hook if this feels off-brand: "The one thing to have on your
> phone on your wedding day."

| Time | On screen | Voice-over / caption |
| --- | --- | --- |
| 0–3s | Phone in hand, venue-style background, "No Service" in the status bar | **Hook:** "The venue has no signal. Where's your run sheet?" |
| 3–10s | The Binder on the phone: "Now: Drinks reception · Next: Speeches 16:30" | "The Binder shows what's on now and what's next, even offline." |
| 10–17s | Scroll the running order; tap a supplier and their phone number appears | "The whole running order, and who to ring when the florist is lost." |
| 17–24s | Search a guest's name and their table appears | "Someone forgot their table? Search, and there it is." |
| 24–30s | Quick cut to the laptop: the same day in Timeline | "It's the same plan you made on your laptop. Nothing to copy over." |
| 30–35s | End card | "Free. Private. No sign-up. Link in bio." |

**Caption:** Your wedding day, in your pocket, no signal needed 📱
#weddingday #weddingplanning #weddinghacks #weddingtok #bridetobe
#groomtobe

---

## 3. Short posts for reuse

**Mastodon / Fediverse (≤500 chars):**
> I built Knotwork, a free, AGPL wedding planner where every tool shares
> one document. Seat your guests and one click puts the table numbers on the
> place cards; move the ceremony and the day moves with it. Local-first (IndexedDB, no account),
> self-hostable, and no analytics on your own instance.
>
> https://github.com/JFrusher/Knotwork
>
> #selfhosted #opensource #localfirst

**Bluesky / X one-liner:**
> Wedding apps keep three copies of your guest list. Knotwork keeps one.
> Free, open source, no sign-up: knotwork-suite.vercel.app

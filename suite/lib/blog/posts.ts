/**
 * The blog: guides to planning a UK wedding, and couples' own stories.
 *
 * Kept as content rather than markup, as the policies are, so a post is
 * edited without reading any React and a couple's story can be added by
 * anyone who can open a pull request. Every fact a guide states is one it
 * can point to: its sources are listed with it, and a figure that comes from
 * one of Trousseau's tools is the tool's own default, which that tool's
 * tests pin.
 */

export interface PostSection {
  heading?: string;
  paragraphs: string[];
}

export interface Post {
  /** The address: /blog/<slug>. Never changed once published — links point at it. */
  slug: string;
  title: string;
  /** For search results and link previews: one or two sentences, under 160 characters. */
  description: string;
  /** ISO date. */
  published: string;
  /** "Trousseau", or the couple who wrote it, as they chose to be named. */
  author: string;
  kind: "guide" | "story";
  /** The tool that does what the post describes, if there is one. */
  tool?: { href: string; name: string; invitation: string };
  sections: PostSection[];
  sources: Array<{ label: string; url: string }>;
}

export const POSTS: readonly Post[] = [
  {
    slug: "how-much-drink-for-a-uk-wedding",
    title: "How much drink to buy for a UK wedding",
    description:
      "Rules of thumb for the drinks reception, the toast, the meal and the evening bar, turned into bottles and cases for 100 guests.",
    published: "2026-09-29",
    author: "Trousseau",
    kind: "guide",
    tool: { href: "/bar", name: "Bar", invitation: "Work it out for your own guest list" },
    sections: [
      {
        paragraphs: [
          "If your venue lets you bring your own drinks — a marquee, a barn, somewhere that charges corkage — you have to decide how much to buy. Buy too little and the bar runs dry at nine o'clock; buy too much and you are storing forty bottles of fizz in the spare room. The good news is that UK weddings drink in a predictable shape, and the sums are simple once you split the day into its parts.",
        ],
      },
      {
        heading: "Split the day into four parts",
        paragraphs: [
          "The drinks reception. Planners' usual rule is two drinks each in the first hour and one an hour after that, so a two-hour reception is about three drinks a head. Most of it is fizz, with beer for those who would rather.",
          "The toast. One glass of fizz each. A 75cl bottle pours six 125ml glasses.",
          "The meal. The rule of thumb is half a bottle of wine a head. Two 175ml glasses is just under that, and some couples find a third of a bottle is plenty, because the people who do not drink wine balance out the people who drink more of it.",
          "The evening bar. About one drink an hour each, split between beer, wine and spirits. If your venue runs a paying bar in the evening, this part is not yours to buy at all.",
        ],
      },
      {
        heading: "Not everyone is drinking",
        paragraphs: [
          "Children, drivers, and anyone who does not drink alcohol will have soft drinks instead — at weddings that is often a fifth of the room. Count them for soft drinks at the same rate, rather than leaving them out, and remember evening-only guests drink in the evening and not before.",
        ],
      },
      {
        heading: "What that comes to for 100 guests",
        paragraphs: [
          "With a fifth not drinking, a two-hour reception, a glass for the toast, two glasses of wine with the meal and a four-hour evening bar, 100 guests come to about 42 bottles of fizz, 36 of white wine and 36 of red, 9 cases of beer, 3 bottles of spirits, 10 litres of mixers, 50 litres of soft drinks and 100 kilos of ice. The wine and fizz are rounded up to whole cases of six, which costs nothing if you buy on sale or return.",
          "Ice is the one people forget. UK ice suppliers suggest about a kilo a person for drinks, and half as much again if you are chilling the bottles in it too.",
        ],
      },
      {
        heading: "Three things that save money",
        paragraphs: [
          "Ask about sale or return. Many UK wine merchants will take back unopened bottles, which makes rounding up safe.",
          "Count what you already have. The gin from the engagement party still counts.",
          "Buy each thing where it is cheapest: fizz and wine from a merchant, beer and spirits from a cash and carry, and mixers, soft drinks and ice from the supermarket.",
        ],
      },
    ],
    sources: [
      { label: "Purple Fizz — how many drinks for my wedding reception", url: "https://www.purplefizz.co.uk/blog/how-many-drinks-for-my-wedding-reception" },
      { label: "Your Fabulous Wedding — how much alcohol do we need", url: "https://yourfabulouswedding.co.uk/how-much-alcohol-do-we-need-for-our-wedding/" },
      { label: "Jaminns Ice — how much ice to order for a wedding", url: "http://www.jaminnsicedelivery.co.uk/how-much-ice-to-order-for-a-wedding/" },
    ],
  },
  {
    slug: "giving-notice-of-marriage",
    title: "Giving notice of marriage in England and Wales",
    description: "What giving notice is, when to do it — at least 29 days before, and no more than a year — and what to take with you.",
    published: "2026-09-29",
    author: "Trousseau",
    kind: "guide",
    tool: { href: "/checklist", name: "Checklist", invitation: "Put it on your checklist, dated from your day" },
    sections: [
      {
        paragraphs: [
          "Before you can marry in England or Wales, each of you has to give notice at a register office — a short appointment where you say who you are marrying, and where and when. It is the one legal step couples most often leave late, and it has a deadline that does not move.",
        ],
      },
      {
        heading: "When",
        paragraphs: [
          "At least 29 days before the ceremony, and no more than a year ahead: a notice lasts twelve months. If either of you is subject to immigration control, the notice period can be extended to up to 70 days, so give yourselves longer.",
          "After you give it, your notice is displayed publicly at the register office for 28 days, so that anyone with a legal objection can raise it. That is why it cannot be done the week before.",
        ],
      },
      {
        heading: "Where",
        paragraphs: [
          "Each of you goes, in person, to the register office for the district where you live — and you must have lived there for at least seven days before you give notice. If you live in different districts, you each go to your own.",
        ],
      },
      {
        heading: "What to take",
        paragraphs: [
          "Proof of your identity and your address: at least two documents between them, such as a passport and a recent bill. If either of you has been married or in a civil partnership before, bring the decree absolute, final order, or death certificate that ended it. Your register office will tell you exactly what it accepts, and the fee, when you book.",
        ],
      },
      {
        heading: "A church wedding is different",
        paragraphs: [
          "In the Church of England, banns are usually read in church instead. Other religious ceremonies generally need notice at a register office like a civil one — your officiant will say which applies to you.",
        ],
      },
    ],
    sources: [
      { label: "Citizens Advice — getting married", url: "https://www.citizensadvice.org.uk/family/living-together-marriage-and-civil-partnership/getting-married/" },
      { label: "Manchester City Council — giving notice of marriage", url: "https://www.manchester.gov.uk/info/200067/marriages_and_civil_partnerships/644/organise_a_marriage" },
      { label: "North Yorkshire Council — giving notice of civil marriage", url: "https://www.northyorks.gov.uk/births-deaths-marriages/marriage-and-civil-partnerships/giving-notice-civil-marriage-or-civil-partnership" },
      { label: "Leeds City Council — giving your notice of marriage", url: "https://www.leeds.gov.uk/births-deaths-and-marriages/ceremonies/giving-your-notice-of-marriage-or-civil-partnership" },
    ],
  },
  {
    slug: "civil-ceremony-music-and-readings",
    title: "Music and readings at a civil ceremony: what your registrar will ask",
    description:
      "A civil ceremony in England and Wales has no religious content, and your registrar approves your music and readings in advance. How to plan for it.",
    published: "2026-09-29",
    author: "Trousseau",
    kind: "guide",
    tool: { href: "/ceremony", name: "Ceremony", invitation: "Plan the order of service, its music and its readings" },
    sections: [
      {
        paragraphs: [
          "A civil ceremony — at a register office or an approved venue — can be as personal as you like, with one firm rule: it has to be free of religious content. That rule covers the music and the readings as well as the words the registrar says, and it catches more couples out than you would think.",
        ],
      },
      {
        heading: "What counts as religious",
        paragraphs: [
          "Hymns, religious readings and prayers are out. Music with religious words is out too, and some registrars will not allow a hymn even as an instrumental. Classical pieces and popular songs are fine as long as their words are not religious — but a love song that mentions God or heaven may be refused, so check the lyrics, not only the title.",
        ],
      },
      {
        heading: "Send your choices in advance",
        paragraphs: [
          "Registrars ask to see, or hear, your music and readings before the day, and they have the final say. How far ahead varies by council — some ask for readings six weeks before — so ask yours when you book, and send everything at once: every reading's text, and every piece of music with who plays it and when.",
          "Keep a note of what has been approved. It is easy to lose track when one reading is swapped for another in the last month.",
        ],
      },
      {
        heading: "Where the music goes",
        paragraphs: [
          "Most civil ceremonies have music in the same places: while guests arrive, for the processional, while you sign the register, and for the recessional as you leave. The signing takes longer than people expect — often five to ten minutes, and your registrar can tell you — so choose something that can run on, or two pieces.",
          "For the processional, decide not just the piece but the cue: which bar, or which lyric, each group sets off on. Your musicians or DJ will want it written down, with where in the track to start if you are skipping an introduction.",
        ],
      },
      {
        heading: "And two witnesses",
        paragraphs: [
          "The register is signed by the two of you and two witnesses, who must be there for the whole ceremony. Decide who they are in advance, and tell them.",
        ],
      },
    ],
    sources: [
      { label: "Law & Religion UK — religious content of civil marriage ceremonies", url: "https://lawandreligionuk.com/2013/07/05/religious-content-of-civil-marriage-ceremonies/" },
      { label: "Hounslow Council — civil ceremonies, frequently asked questions", url: "https://www.hounslow.gov.uk/downloads/file/10635/frequently-asked-questions-civil-ceremonies" },
      { label: "OUPblog — why certain music is banned from the civil marriage ceremony", url: "https://blog.oup.com/2017/03/music-in-civil-marriage-ceremonies/" },
    ],
  },
  {
    slug: "packing-for-the-wedding-day",
    title: "Packing for the wedding day: four boxes that cover it",
    description: "The rings and the paperwork, getting ready, the day's odds and ends, and overnight — and why each box needs a time, a place and a person.",
    published: "2026-09-29",
    author: "Trousseau",
    kind: "guide",
    tool: { href: "/boxes", name: "Boxes", invitation: "Pack your own boxes, each tied to its part of the day" },
    sections: [
      {
        paragraphs: [
          "On the morning of the wedding, the question is never whether you packed something. It is where it is. The shoes are in a box, but which box, and is that box at the house or already at the venue? Four boxes cover nearly every wedding, as long as each one has three things written on it: where it needs to be, by when, and who is taking it.",
        ],
      },
      {
        heading: "The rings and the paperwork",
        paragraphs: [
          "The rings, any documents the registrar or officiant has asked for, the envelopes of cash for suppliers who are paid on the day, and the speeches. This is the box that must not go astray, so it has one named person and it goes to the ceremony, not to the evening venue.",
        ],
      },
      {
        heading: "Getting ready",
        paragraphs: [
          "Shoes, the steamer, the emergency kit — safety pins, plasters, a sewing kit, painkillers — make-up, phone chargers and something to eat. It needs to be wherever you are getting ready, before the hair and make-up start rather than when they finish.",
        ],
      },
      {
        heading: "The day's odds and ends",
        paragraphs: [
          "The guest book and pens, the table plan, the place cards, the favours, the cake knife, the card box. It goes to the venue early, often with a supplier or a friend who is helping set up, and it is the box people forget to name anyone for.",
        ],
      },
      {
        heading: "Overnight and the day after",
        paragraphs: [
          "Clothes for the morning, toiletries, and — if you are going straight on honeymoon — the passports. This one is not needed during the day at all, which is why it gets left in the wrong car.",
        ],
      },
      {
        heading: "Tie each box to the day",
        paragraphs: [
          "The trick is not the list of what is in each box; it is tying each box to a part of the day. \"This box has my shoes in it and needs to be at the house for nine\" is a sentence someone can act on. If the time the hair and make-up start moves, the box's deadline moves with it — which is only easy if the box knows which part of the day it belongs to, rather than having a time scribbled on its side.",
        ],
      },
    ],
    sources: [],
  },
];

export const postBySlug = (slug: string): Post | undefined => POSTS.find((post) => post.slug === slug);

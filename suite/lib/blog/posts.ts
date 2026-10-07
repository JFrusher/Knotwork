/**
 * The blog: guides to planning a UK wedding, and couples' own stories.
 *
 * Kept as content rather than markup, as the policies are, so a post is
 * edited without reading any React and a couple's story can be added by
 * anyone who can open a pull request. Every fact a guide states is one it
 * can point to: its sources are listed with it, and a figure that comes from
 * one of Knotwork's tools is the tool's own default, which that tool's
 * tests pin.
 */

interface PostSection {
  heading?: string;
  paragraphs: string[];
}

interface Post {
  /** The address: /blog/<slug>. Never changed once published — links point at it. */
  slug: string;
  title: string;
  /** For search results and link previews: one or two sentences, under 160 characters. */
  description: string;
  /** ISO date. */
  published: string;
  /** "Knotwork", or the couple who wrote it, as they chose to be named. */
  author: string;
  kind: "guide" | "story";
  /** The tool that does what the post describes, if there is one. */
  tool?: { href: string; name: string; invitation: string };
  sections: PostSection[];
  sources: Array<{ label: string; url: string }>;
}

export const POSTS: readonly Post[] = [
  {
    slug: "print-your-own-place-cards",
    title: "How to print your own place cards",
    description:
      "Check your printer's scale on plain paper, line up the backs if you print both sides, and let the table numbers come from the seating plan.",
    published: "2026-10-07",
    author: "Knotwork",
    kind: "guide",
    tool: { href: "/stationery", name: "Stationery", invitation: "Make your own place cards" },
    sections: [
      {
        paragraphs: [
          "You can print place cards at home on an ordinary printer. Measure what your printer does to sizes before you print on card, line the backs up if you print both sides, and take the names and table numbers from the seating plan rather than typing them. That is all a print service does for you. This is written for UK weddings, and A4, but nothing in it is law.",
        ],
      },
      {
        heading: "The paper",
        paragraphs: [
          "Use the heaviest card your printer says it will feed, and buy a few sheets more than you need. Before any of it goes in, print on plain paper. Stationery's Two test cards button prints the first two cards on one sheet, at true size, with the cut lines on, so your first print is never on the good card.",
          "The classic place card in Stationery is 85 by 55mm, flat, with the name in the middle and the table beneath it. Change the size under Format, and Stationery works out how to fit the most cards on a sheet.",
        ],
      },
      {
        heading: "Check the scale first",
        paragraphs: [
          "Printer drivers often shrink a page a little to fit it, and you will not notice until the cards are too small for their holders. So measure it. In Stationery, open Print setup under Output and press Download calibration page. Print it at 100%, with \"fit to page\" turned off, and measure the line printed on it, which should be 100mm. Type in what you measured and save it.",
          "From then on every export is corrected for that printer, and the correction is printed on the sheet, so a print that comes out wrong says why. The same page has a cross 10mm in from each edge. If one is missing or cut off, your printer cannot reach that edge: type the border you measured and Stationery warns you when a fold or a bleed lands in it.",
        ],
      },
      {
        heading: "Printing both sides",
        paragraphs: [
          "A card with something on the back, a menu or a message, has to have its back land behind its front. Most home printers are a millimetre or two out, and some turn the paper on the other edge to the one you expect.",
          "Under Print setup, open Double-sided. Choose the edge your printer turns the paper on, usually the long edge, and download the duplex test sheet. Print it on both sides of one sheet of thin paper, at 100%, and hold it up to a window, reading from the back. A mark inside its box means the edge is right. Four numbered scales show how far out the back is: type in what each one reads and apply them, and the backs are moved by that much. Print the test again and all four should read 0.",
          "If the two pairs of scales disagree by more than a millimetre, the sheet went through crooked. Moving the back cannot fix that, so feed the paper straight and test again.",
        ],
      },
      {
        heading: "Table numbers from the plan",
        paragraphs: [
          "Do not type the names in. The place cards read the guest list and the seating plan, so each card already carries the guest's name and their table, and only guests who are coming get one. Someone with no table yet still gets a card, with the table left blank, and Stationery tells you how many there are.",
          "Plans change after you print. When they do, Stationery says which cards have changed since you printed them and offers to print just those, so a late change costs one sheet, not the set.",
        ],
      },
    ],
    sources: [],
  },
  {
    slug: "a-wedding-day-timeline-you-can-move",
    title: "A wedding day timeline you can move",
    description:
      "Fix the few times that cannot move, let everything else follow, and see what happens when the ceremony starts ten minutes late.",
    published: "2026-10-07",
    author: "Knotwork",
    kind: "guide",
    tool: { href: "/timeline", name: "Timeline", invitation: "Plan your own day" },
    sections: [
      {
        paragraphs: [
          "A wedding day timeline that survives the day is built from lengths, not times. Fix the handful of times that really cannot move, give everything else a length and let it follow the thing before it, and leave slack before each fixed time. Then when something moves by ten minutes, you can see straight away what follows, what collides and what runs past the curfew. This is written for UK weddings, but nothing in it is law.",
        ],
      },
      {
        heading: "Fixed times, and everything else",
        paragraphs: [
          "Only a few times on the day are really fixed: the ceremony, if a registrar or a church has given you a slot; the meal, if the kitchen serves at a set time; the cars; the end of the night. In Timeline these are anchored, with Anchored at set to the time.",
          "Everything else floats. A floating block has a length and a gap after the block before it, and starts when that block ends. Getting ready, the confetti, the drinks, the group photographs: none of them has a time of its own, only a place in the order.",
        ],
      },
      {
        heading: "When the ceremony moves ten minutes",
        paragraphs: [
          "Say the ceremony moves from 13:30 to 13:40. Everything floating after it moves ten minutes with it, with nothing else changed. While you drag a block, Timeline shows where the blocks after it will land before you let go.",
          "What does not move is the next fixed time. If the meal is anchored at 16:00, the run between the ceremony and the meal now has ten minutes less. If something in that run can be shortened, give it Can be squeezed and the shortest it may run, and Timeline takes the time out of it and tells you by how much. If nothing can give, it says which block overruns into the meal, and by how many minutes, so you know where to cut.",
        ],
      },
      {
        heading: "Collisions and the curfew",
        paragraphs: [
          "Timeline checks the day as you build it. It warns when two fixed blocks in the same lane overlap, when a supplier is in two places at once, and when the last block in a lane ends after the curfew you set, and by how much.",
          "Lanes run side by side: the couple's day in one, the band's in another, so the band can set up during the speeches. Within a lane, each block follows the one before.",
        ],
      },
      {
        heading: "Leave slack before the fixed times",
        paragraphs: [
          "The slack is what absorbs a late car or a long speech. Each block can carry a contingency, a few minutes after it that nothing is planned into. Put it before the fixed times, where an overrun would otherwise collide, not at the end of the day where it does nothing.",
        ],
      },
      {
        heading: "Everyone's copy follows",
        paragraphs: [
          "A timeline is only useful if everyone has the current one. Timeline prints a run sheet, a call sheet for each supplier and an order of the day, and it will not print while two blocks clash, because a sheet that contradicts itself is worse than none. It also downloads a calendar file, for the whole day or one supplier's part of it.",
          "The other tools read the same day. Delegation's job sheets, the times on your boxes and each supplier's own link take their times from it, so moving the ceremony moves them too.",
        ],
      },
    ],
    sources: [],
  },
  {
    slug: "how-to-make-a-wedding-seating-chart",
    title: "How to make a wedding seating chart, and keep it up to date",
    description:
      "Start from the guest list, draw the room to scale, seat the hard cases first, then make the place cards and the caterer's list from the chart.",
    published: "2026-10-07",
    author: "Knotwork",
    kind: "guide",
    tool: { href: "/seating", name: "Seating", invitation: "Draw your room and seat your guests" },
    sections: [
      {
        paragraphs: [
          "Start from the guest list, draw the room to scale, seat the people with rules first and everyone else after, and make the place cards and the caterer's list from the chart rather than typing them again. That last part is the one that keeps it up to date. This is written for UK weddings, but none of it is law, so it works anywhere.",
        ],
      },
      {
        heading: "Why seating charts go wrong",
        paragraphs: [
          "A seating chart is rarely one list. It is the chart, the place cards and the sheet the caterer asked for, and each starts as a copy of the same names. Then someone replies late, a cousin turns vegan, a table is renamed after the florist's centrepiece, and each change has to be made three times. Sooner or later one of the three is missed, and it is usually the place cards, because they were printed first.",
          "So the aim is one list, with the chart, the cards and the caterer's sheet all read from it.",
        ],
      },
      {
        heading: "1. Start from the guest list you already have",
        paragraphs: [
          "Export it as a CSV from wherever it lives now and import it. You see what will change before anything is saved. When a newer list comes in later, import that too: it adds the new names and updates the changed ones, and everyone already on the list keeps their seat. Anyone on your list who is not in the file is shown to you, and only goes if you tick them.",
        ],
      },
      {
        heading: "2. Draw the room to scale",
        paragraphs: [
          "Ask the venue for a plan with measurements, or measure one wall yourself. In Seating's settings, press Calibrate, draw a line along a wall you know and type what it measures, and the whole plan is to scale. Then place the tables.",
          "Scale matters because chairs need room. If two tables are too close for the chairs to clear, Seating says so. If they do not fit on the plan, they will not fit on the day.",
        ],
      },
      {
        heading: "3. Seat the hard cases first",
        paragraphs: [
          "Before anyone else, write down who should not sit together and who should, and seat those people first. Seating keeps the rules and warns you when the chart breaks one. It warns rather than stops you, because sometimes you break a rule on purpose.",
          "Families are worth the same care. Put a family together in Seating and it tells you when you have split them across tables. It also tells you when a table has more people than chairs.",
        ],
      },
      {
        heading: "4. Then everyone else",
        paragraphs: [
          "The rest goes quickly once the hard cases are placed. On the Guests page, show only the people who are coming and have no table yet, tick them, and move them to a table in one go. The front page counts how many still have no table, so you know when you are finished.",
        ],
      },
      {
        heading: "5. The caterer's list",
        paragraphs: [
          "Your caterer will want two things: the dietary needs in total, and which table each one is at. Do not type that up. Seating's Export gives you a CSV of who is at each table, and a dietary and headcount report with the totals and a summary per table. Send it again whenever the chart changes; it takes a click.",
        ],
      },
      {
        heading: "6. Place cards from the chart",
        paragraphs: [
          "Make the place cards in Stationery and they read the table from the chart. Rename a table and the cards say the new name with nothing pressed.",
          "Once you have printed them, the chart can still change. When it does, Stationery names the cards that are now wrong and offers to print just those, so a late change costs one sheet, not the whole set.",
        ],
      },
    ],
    sources: [],
  },
  {
    slug: "design-your-order-of-service",
    title: "Designing your order of service, in your own style",
    description:
      "Write the ceremony once, then design a folded A5 booklet around it — cover, pages, pictures — and print it at home or send it to a print shop.",
    published: "2026-10-06",
    author: "Knotwork",
    kind: "guide",
    tool: { href: "/ceremony", name: "Ceremony", invitation: "Start your order of service" },
    sections: [
      {
        paragraphs: [
          "The order of service is the one piece of stationery every guest holds. It tells them who you are, what is about to happen, when to stand, and the words to a reading they might want to keep. It is also the piece most likely to be wrong: a reading swapped in the last fortnight, a hymn moved, a name misspelt. The way round that is to write the ceremony once, in one place, and let the booklet be made from it.",
          "This guide walks through doing that in Knotwork, from a blank ceremony to a folded booklet on the table at the door. In the app, the same walk is pointed out on the real buttons: press Show me how in Ceremony.",
        ],
      },
      {
        heading: "1. Write the ceremony, in order",
        paragraphs: [
          "Open Ceremony and choose what kind of ceremony it is. Suggest an order of service gives you a sensible start for that kind — a civil ceremony follows the registrar's legal words, a Church of England one the Common Worship marriage service — and every part of it is yours to rename, move or take out.",
          "Pick a part to fill it in. A reading has a title and, separately, whose words they are — \"Sonnet 116\" by \"William Shakespeare\", or \"1 Corinthians 13:4–8\" — so the booklet can set the two differently. Name who reads it from your guest list, so the right name is printed even if they change their surname before the day.",
          "A note for the guests goes under the part's title: \"Please stand\", \"Please remain seated\", \"Confetti outside, please\". Write it once here and it is in the booklet and on your guest link alike.",
        ],
      },
      {
        heading: "2. Decide what is printed in full",
        paragraphs: [
          "For each part you choose whether its words go in the booklet, and separately whether a song's lyrics do. Many couples print the readings, so guests can keep them, and leave the vows to be heard. Hymns usually go in full so everyone can sing.",
          "Words can be set three ways. A poem is set line by line, as you typed it. Prose runs on as paragraphs. Responses are for the parts everyone says together: start a line with \"All:\" and it is printed in bold — \"All: We will.\" — which is how service sheets in most traditions set them.",
          "In a civil ceremony your registrar approves the readings and the music in advance, and the content has to be free of anything religious. Ceremony keeps track of which you have had approved and counts any still waiting, so check it says none before you print.",
        ],
      },
      {
        heading: "3. Add the music",
        paragraphs: [
          "Give each piece its title, composer or artist, and its arrangement if it is not the original — \"arranged for string quartet\". The processional's music belongs to the groups who walk to it, and the booklet names each piece under The processional unless you turn that off.",
          "If a piece is set to fade before its part ends — a five-minute track for a ten-minute signing — Ceremony says how long the room will be quiet, so you can choose a second piece before the day rather than during it.",
        ],
      },
      {
        heading: "4. Say the rest: welcome, who's who, what's next, thank you",
        paragraphs: [
          "Under The guests' order of service in Ceremony you can add a note from the two of you to open the booklet, and one to close it. You can list the wedding party — parents, grandparents, bridesmaids, groomsmen — straight from the people you named in Group shots, so the names match the photographs. And you can tick the parts of the day that come after the ceremony, from your Timeline, so guests know the drinks are on the lawn at half past two.",
          "None of this is typed into the booklet itself. Move the drinks to three o'clock on the Timeline and the booklet already says three.",
        ],
      },
      {
        heading: "5. Choose a style, then make it yours",
        paragraphs: [
          "Press Design the order of service. It opens in Stationery as a folded A5 booklet: a cover, inside pages, and a back. The first time, it starts from Classic. Open Designs to see the others — Modern and Script — each drawn with your own names; Restyle swaps one for another and keeps any pictures you have added.",
          "A style is only a starting point. Click anything to change its font, size, colour or position, or add your own text, lines, shapes and pictures from Elements. Your names, date and venue are filled in wherever the design says {{Couple}}, {{Date}} or {{Venue}}, and {{Page}} prints the page number.",
        ],
      },
      {
        heading: "6. The cover, the inside, the back",
        paragraphs: [
          "Above the page are three buttons: Cover, Inside and Back. The cover and the back are designed once each. The inside is designed once and repeated on every inside page, so a border, a monogram or a sprig of flowers in the corner appears throughout without being placed again.",
          "Something you want on one page only — a photograph of the two of you, a picture of the church — goes on the inside with Only on pages set to that page number. To change a single page in any other way, tick Just this one and the change applies to that page alone.",
          "The ceremony sits in its own box on the inside pages. Click it to choose the fonts and sizes for the titles, the details and the words, and how much space falls between parts. When the box is full the ceremony carries on in the same box on the next page, and a title is never left alone at the foot of a page.",
        ],
      },
      {
        heading: "7. Pictures and fonts",
        paragraphs: [
          "Upload photographs, illustrations or a monogram under Images, then place them with an Image element: fill the box and drag to crop, or fit the whole picture inside it. Pale artwork behind text works well at a low opacity.",
          "Six faces come with Knotwork, from Crimson Text and Lato to Great Vibes and Parisienne for script. You can upload your own under Fonts — a face from your invitations, say — and use it anywhere in the booklet.",
        ],
      },
      {
        heading: "8. Mind the page count",
        paragraphs: [
          "A booklet made by folding sheets in half always has a multiple of four pages. If your ceremony fills five, the booklet has eight, and Stationery tells you how many pages are blank only so that it folds. Use them — a welcome, the wedding party, a photograph, a page for notes — or make the ceremony's type a little smaller to fit on fewer and save a sheet.",
        ],
      },
      {
        heading: "9. Print it",
        paragraphs: [
          "At home, choose to print folded under Sheet. The PDF puts two pages side by side on each side of A4, already in the order folding needs, so you print both sides, take the stack, fold it in half, and the pages run 1, 2, 3, 4. Your printer turns the paper over either on its long edge or its short one; set yours under Print setup and the backs come out the right way up. Print one copy on plain paper and fold it before you print the rest.",
          "Home printers cannot print right to the edge of the paper, so keep words a centimetre in from it, and expect a white border round a full-colour cover. If you want colour to the very edge, choose to send it to a print shop instead: each page comes out on its own, with three millimetres of bleed past its edges and crop marks outside them, which is what a shop's own software expects.",
        ],
      },
      {
        heading: "10. And on their phones",
        paragraphs: [
          "If you publish a guest link — the page guests use to find their table — you can put the order of service on it too, from the same switch in Ceremony. It shows exactly what the booklet prints, so someone who has left theirs on the chair can still follow along, and someone who needs larger type can zoom in.",
        ],
      },
    ],
    sources: [
      { label: "Hounslow Council — civil ceremonies, frequently asked questions", url: "https://www.hounslow.gov.uk/downloads/file/10635/frequently-asked-questions-civil-ceremonies" },
    ],
  },
  {
    slug: "how-much-drink-for-a-uk-wedding",
    title: "How much drink to buy for a UK wedding",
    description:
      "Rules of thumb for the drinks reception, the toast, the meal and the evening bar, turned into bottles and cases for 100 guests.",
    published: "2026-09-29",
    author: "Knotwork",
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
    author: "Knotwork",
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
    author: "Knotwork",
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
    author: "Knotwork",
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

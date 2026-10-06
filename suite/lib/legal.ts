/**
 * The published policies, as content rather than markup.
 *
 * Kept as data so the effective date can be held to the words it belongs to.
 * A date that says January while the text changed in June is worse than no date
 * at all — it is a claim about when the reader was last told something, and it
 * is false. `lib/legal.test.ts` hashes these sections and fails if the words
 * move without `updated` moving with them.
 *
 * Written to be read. Everything here is a plain statement of what the code in
 * this repository actually does, and where that is inconvenient it says so
 * rather than reaching for a phrase that covers it.
 */

export interface Section {
  heading: string;
  paragraphs: string[];
}

export interface Policy {
  title: string;
  /** ISO date. Bump it whenever `sections` changes — the test insists. */
  updated: string;
  /** SHA-256 of the sections, recorded so a silent edit cannot pass. */
  digest: string;
  intro: string;
  sections: Section[];
}

export const CONTROLLER = {
  name: "Jacob Frusher",
  email: "jacob@frusher.co.uk",
  jurisdiction: "England and Wales",
} as const;

/** Also stated in `lib/documents/retention.ts`. The two must not drift. */
export const RETENTION_MONTHS = 24;

export const PRIVACY: Policy = {
  title: "Privacy",
  updated: "2026-10-06",
  digest: "155ff0eba13d11de",
  intro:
    "Knotwork is a wedding planning tool that keeps your wedding in your own browser. This page says exactly what is stored, where, for how long, and what I can and cannot see.",
  sections: [
    {
      heading: "Who is responsible",
      paragraphs: [
        `This is run by ${CONTROLLER.name}, who can be reached at ${CONTROLLER.email}. It is a personal project, not a company.`,
        "For a wedding you create, you decide what goes into it.",
        "It reaches a server only if you make an account. Then I hold your wedding in a database — encrypted at rest, walled off from every other account, but readable by whoever runs the server. That is described below, and it does not happen unless you choose it.",
      ],
    },
    {
      heading: "Where your wedding lives",
      paragraphs: [
        "In your browser. Guests, seating, the running order, the crew and the stationery are all stored on the device you are using, in IndexedDB, and nothing is sent anywhere by default.",
        "You can use the whole application without any of it ever reaching a server. Making an account changes that — to plan on more than one device, with your partner, or with your planner — and so does publishing a link for your guests or your suppliers, which needs one.",
      ],
    },
    {
      heading: "What an account holds, and who can read it",
      paragraphs: [
        "An account exists so you and your partner can plan on separate devices. Making one stores your email address — there is no password, no profile, and no name field. Signing in with your email sends a six-digit code to that address; entering it is what proves it is you. If you choose Continue with Google or Continue with Apple instead, that company confirms who you are and tells the app your email address, along with the name on that account, which the sign-in service keeps with your account and the app never reads or shows. Google or Apple learn that you signed in here; neither ever sees your wedding.",
        "Your wedding is then stored in a database as one document, encrypted at rest, with database rules that make it unreadable to any other account. Inviting your partner or your planner adds exactly that person, by the email address you name. Either of you can see everyone who has access, and remove your planner at any time.",
        "Being straight about it: this is ordinary, well-guarded storage, not encryption I cannot undo. I do not read your wedding and there is no support tool that would let me browse it, but I administer the database, so I could. If that matters more to you than planning across devices does, use the app without an account — it is the default, and nothing leaves your browser.",
        "Earlier versions are kept alongside the current one, so a mistake can be recovered rather than being final: one for every ten minutes each of you spends changing it, and past a month, one for each day it changed.",
        "While more than one of you has the wedding open, each change reaches the others as it is saved. What travels to announce it is a version number, not the wedding; each device then fetches the change the way it fetches everything else. The others with it open see your email address and which page you are on — nobody outside the wedding does.",
        "A planner can also keep a library of their own — card designs, rooms, running orders and checklists — to use again for other weddings. It is theirs alone: no other account can see it, and nothing personal goes into it, so no guests, no dates and no suppliers' names or numbers. It stays until they remove it or delete their account.",
      ],
    },
    {
      heading: "What a guest link contains",
      paragraphs: [
        "Deliberately less than the wedding does. A published link carries names and table numbers, and optionally the shape of the room. If you choose, it also carries your order of service as your printed booklet has it: its parts and music, who leads each, the words you chose to print, the wedding party's names, the times of the parts of the day you picked, and your own notes to the guests. It does not carry email addresses, phone numbers, dietary requirements, notes for whoever runs the day, or anybody who has declined.",
        "It is encrypted under a key that travels in the link's own fragment — the part after the # — which browsers never send to a server. What the server hands out is sealed; without the whole link, it cannot be read.",
        "The key is also kept with your wedding on your account, so whichever of you changes the seating can keep the link current. That makes it exactly as readable to whoever runs the server as the wedding itself — which already holds everything the link does, and more.",
        "There is only ever one live link per wedding, and it updates itself as seats change, so a link you have already given out stays correct. Taking it down deletes it outright.",
      ],
    },
    {
      heading: "What a supplier's link contains",
      paragraphs: [
        "Each supplier can be given a link to their own call sheet: when to arrive, which of their people are named, and their jobs with the times, places and dates — with the couple's names, the date and the venue. It carries no guests at all, and nothing of any other supplier's.",
        "It is sealed the same way as the guest link, under a key in the link's fragment that is also kept with your wedding, and it updates itself as their jobs and times change.",
        "It has one button, Confirm. Pressing it records when, against that link and nothing else, and that date shows on your wedding as the day they confirmed. Taking the link down deletes it outright, and it goes by itself if that supplier is removed from your wedding.",
      ],
    },
    {
      heading: "How long it is kept",
      paragraphs: [
        `A wedding on an account that is not written to for ${RETENTION_MONTHS} months is deleted automatically, along with its history, its uploaded files, its guest link and its suppliers' links. That is long enough to cover an engagement, the wedding, and a year of still wanting the seating plan.`,
        "There is no backup that outlives this. When it is deleted, it is gone.",
      ],
    },
    {
      heading: "Deleting it yourself",
      paragraphs: [
        "Deleting your account is on the account page — signing in is what proves it is yours. It takes you off every wedding you are on, and deletes each one nobody else is still on, with its history, its files, its guest link and its suppliers' links, immediately. A wedding someone else is on stays with them, because it is their wedding too.",
        "Leaving one wedding works the same way, for that wedding alone. Deleting your account also deletes your library, if you kept one.",
        "Your own browser keeps its copy unless you choose otherwise, because withdrawing from a server is not the same as wanting to lose your seating plan. Signing out asks whether to remove it from the device; clearing this site's data in your browser removes it too.",
      ],
    },
    {
      heading: "Cookies, tracking and counting visits",
      paragraphs: [
        "No advertising, no tracking pixels, and nothing that follows you from one website to another.",
        "On the hosted site — this one, not a copy somebody runs elsewhere — visits to each page are counted with Vercel Web Analytics, the host's own counter. For each page it records the page's address, the site the visit came from, the country, and the kind of browser, system and device. Before an address is sent, anything in it that is not simply the page is cut out: the token in a guest link, a supplier's link or an invitation, the id of a wedding, and everything after a ? or a #. Nothing from your wedding is in it — no guest, no name, no table.",
        "The hosted site also sends the page's address to Vercel Speed Insights, to measure how quickly pages load. That address is cut the same way first.",
        "It sets no cookie and stores nothing on your device. It tells one visit from another by a code worked out from the request, which changes every day, so a visit cannot be linked to one on another day or on another website. It is done on the basis of legitimate interest: knowing which parts of the site are used.",
        "One cookie exists, and only if you sign in: it holds your session, which is what keeps you signed in between visits. It is not used to track you and there is nothing to opt into, because without an account no cookie is set at all.",
        "The browser storage that is used — IndexedDB — holds your wedding, which is the thing you came here to work on. Nothing about you is stored for any other purpose.",
      ],
    },
    {
      heading: "Error reporting",
      paragraphs: [
        "When something breaks, a diagnostic report may be sent to Sentry, an error-monitoring service, so the fault can be found and fixed. Sentry is one of three services that run the hosted site: Vercel hosts it and counts visits, as above; Supabase holds the database behind accounts and sends the sign-in emails; and Sentry receives these reports.",
        "It is configured narrowly and on purpose. No session recording, no personal data, and no console output — the tools log parts of the document while they work, and that is the guest list. Web addresses have their fragment removed before anything is sent, so the key in a guest link can never reach it.",
        "This is done on the basis of legitimate interest: keeping the application working. It sets no cookies and reads nothing from your device.",
      ],
    },
    {
      heading: "Staying signed in",
      paragraphs: [
        "Signing in keeps a session in this browser until you sign out, so you are not asked for a link on every visit.",
        "The practical consequence is worth stating: on a shared or borrowed computer, signing out matters. Anyone using that browser afterwards can reach the wedding.",
      ],
    },
    {
      heading: "Stories for the blog",
      paragraphs: [
        "If you email your wedding story for the blog, it is read by me and kept in my email while we agree what is published. Nothing goes up until you have seen the page and said yes, it carries only the names you choose, and it is changed or taken down whenever you ask. A story that is not published is deleted.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "Under UK GDPR you have rights of access, correction, erasure and portability. Most of them are already buttons rather than requests: 'Export backup' gives you the entire wedding as one file, 'Download my wedding' on the account page does the same from the server copy, and the delete buttons above remove it.",
        `For anything else, or if you think something here is wrong, write to ${CONTROLLER.email}. You can also complain to the Information Commissioner's Office.`,
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "The date at the top of this page is the date these words last changed, and it is kept honest by a test that fails if the text moves without it.",
      ],
    },
  ],
};

export const TERMS: Policy = {
  title: "Terms",
  updated: "2026-09-28",
  digest: "2e9a45548776337c",
  intro:
    "Short, because there is not much to agree about: this is free software, given as it is, that mostly runs on your own machine.",
  sections: [
    {
      heading: "What this is",
      paragraphs: [
        "A free wedding planning tool, and open source: the application is under the AGPL, and the data format it is built on is under the MIT licence. There is no subscription, no paid tier, and nothing to pay. There never will be — that is the point of it.",
        "An account is optional and also free. It exists to plan on more than one device and to share a wedding with your partner or your planner, not to unlock anything.",
        "It was built for one wedding and then made available to anyone who wants it. It is offered as it is, with no warranty and no promise that it is fit for any particular purpose.",
      ],
    },
    {
      heading: "Your guest list is yours",
      paragraphs: [
        "If you put other people's names, dietary requirements or contact details into this tool, you are the one responsible for them. You need your own reason to hold that information, and you should tell those people what you are doing with it if they would not otherwise expect it.",
        "The design helps: it stays on your device unless you choose otherwise, and a guest link deliberately publishes far less than you hold.",
      ],
    },
    {
      heading: "Using the shared backend fairly",
      paragraphs: [
        "Accounts, syncing and guest links run on a small server paid for personally. There are limits — how often a wedding can be created, how large a wedding can get, and how much can be uploaded to one — and they are set generously for planning a wedding and meanly for anything else.",
        "Do not use it as file storage, do not try to work around the limits, and do not attempt to reach a wedding that is not yours — by guessing a guest link, an invite, or anything else.",
      ],
    },
    {
      heading: "It may not always be there",
      paragraphs: [
        "There is no uptime guarantee, no support commitment, and no promise that the hosted service will continue to exist. It may be withdrawn at any time. The source is public and documented for self-hosting precisely so that is survivable.",
        "This is why the export button matters. A backup file is the whole wedding, it opens in any copy of this application, and it does not depend on me at all. Take one.",
      ],
    },
    {
      heading: "Liability",
      paragraphs: [
        "To the extent the law allows, I am not liable for any loss arising from using this — including lost data, a plan that turned out to be wrong, or a service that was unavailable when you needed it.",
        "Nothing here limits liability for death or personal injury caused by negligence, or for fraud, because it cannot.",
      ],
    },
    {
      heading: "Law",
      paragraphs: [
        `These terms are governed by the law of ${CONTROLLER.jurisdiction}, and its courts have exclusive jurisdiction.`,
      ],
    },
  ],
};

export const POLICIES = [PRIVACY, TERMS];

/** The words, in the order they are published. What the digest is taken over. */
export function policyText(policy: Policy): string {
  return [
    policy.title,
    policy.intro,
    ...policy.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
  ].join("\n");
}

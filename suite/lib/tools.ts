import { Armchair, Banknote, Camera, ClipboardList, Clock, Contact, Footprints, LayoutDashboard, ListChecks, Package, Smartphone, Users, Wine, type LucideIcon } from "lucide-react";

/** What a wedding stores to say it shows a tool. Never renamed: it is data. */
export type ToolId =
  | "seating"
  | "place-cards"
  | "timeline"
  | "delegation"
  | "group-shots"
  | "ceremony"
  | "boxes"
  | "bar"
  | "money"
  | "checklist"
  | "binder";

/** A way into one part of the wedding, as a tab in the header. */
export interface Tab {
  href: string;
  name: string;
  icon: LucideIcon;
  /**
   * The token class carrying this tab's palette.
   *
   * The tab is where a tool is identified now that the wordmarks have gone, so
   * the active one is underlined in the colour that tool uses throughout. The
   * class rather than a hex value, because the colour is decided once in
   * `lib/design/tokens.css` and this should not hold a second opinion about it.
   */
  tokens: string;
}

/** Something a wedding can add from the toolbox, or remove. */
export interface Tool extends Tab {
  id: ToolId;
  href: `/${ToolId}`;
  tagline: string;
  /** Shown in a wedding that has never chosen. */
  defaultOn: boolean;
}

/**
 * The guest list: always the first tab, and never removable, because every
 * tool is built on it.
 */
export const GUESTS: Tab = { href: "/guests", name: "Guests", icon: Users, tokens: "tableaux-tokens" };

/**
 * Every tool, in the order the header draws them: the five in the order the
 * day is planned in, on by default, then those a wedding adds when it wants
 * them.
 */
export const TOOLS: readonly Tool[] = [
  {
    id: "seating",
    href: "/seating",
    tokens: "tableaux-tokens",
    name: "Seating",
    tagline: "Build the room, then put people in it.",
    icon: Armchair,
    defaultOn: true,
  },
  {
    id: "place-cards",
    href: "/place-cards",
    tokens: "plaque-tokens",
    name: "Place cards",
    tagline: "Print-ready cards from the plan you just made.",
    icon: Contact,
    defaultOn: true,
  },
  {
    id: "timeline",
    href: "/timeline",
    tokens: "cadence-tokens",
    name: "Timeline",
    tagline: "The run of the day, and what collides.",
    icon: Clock,
    defaultOn: true,
  },
  {
    id: "delegation",
    href: "/delegation",
    tokens: "brigade-tokens",
    name: "Delegation",
    tagline: "The jobs, and the hands doing them.",
    icon: ClipboardList,
    defaultOn: true,
  },
  {
    id: "group-shots",
    href: "/group-shots",
    tokens: "ensemble-tokens",
    name: "Group shots",
    tagline: "The family photo list, built from who's who.",
    icon: Camera,
    defaultOn: true,
  },
  {
    id: "ceremony",
    href: "/ceremony",
    tokens: "ensemble-tokens",
    name: "Ceremony",
    tagline: "Who walks down the aisle, in what order, and to what.",
    icon: Footprints,
    defaultOn: false,
  },
  {
    id: "boxes",
    href: "/boxes",
    tokens: "brigade-tokens",
    name: "Boxes",
    tagline: "What is packed in which box, and where each has to be, by when.",
    icon: Package,
    defaultOn: false,
  },
  {
    id: "bar",
    href: "/bar",
    tokens: "brigade-tokens",
    name: "Bar",
    tagline: "How much drink to buy, in bottles and cases, and roughly what it costs.",
    icon: Wine,
    defaultOn: false,
  },
  {
    id: "money",
    href: "/money",
    tokens: "brigade-tokens",
    name: "Money",
    tagline: "What each supplier costs, what is paid, and what falls due.",
    icon: Banknote,
    defaultOn: false,
  },
  {
    id: "checklist",
    href: "/checklist",
    tokens: "brigade-tokens",
    name: "Checklist",
    tagline: "What to have done before the day, each with a date.",
    icon: ListChecks,
    defaultOn: false,
  },
  {
    id: "binder",
    href: "/binder",
    tokens: "cadence-tokens",
    name: "Binder",
    tagline: "The day on your phone, with or without signal.",
    icon: Smartphone,
    defaultOn: false,
  },
];

/**
 * The wedding's own pages, as against its tools: views over the whole of it,
 * under the wedding's name in the header.
 */
export interface WeddingPage {
  href: string;
  name: string;
  icon: LucideIcon;
}

export const WEDDING_PAGES: readonly WeddingPage[] = [{ href: "/", name: "Overview", icon: LayoutDashboard }];

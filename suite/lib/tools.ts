import { Armchair, Banknote, Camera, ClipboardList, Clock, Contact, LayoutDashboard, ListChecks, Smartphone, Users, type LucideIcon } from "lucide-react";

/** What a wedding stores to say it shows a tool. Never renamed: it is data. */
export type ToolId = "seating" | "place-cards" | "timeline" | "delegation" | "group-shots";

/** The five tools, in the order the day is planned in. Nav and landing share this. */
export interface Tool {
  id: ToolId;
  href: `/${ToolId}`;
  name: string;
  tagline: string;
  icon: LucideIcon;
  /**
   * The token class carrying this tool's palette.
   *
   * The tab is where a tool is identified now that the wordmarks have gone, so
   * the active one is underlined in the colour that tool uses throughout. The
   * class rather than a hex value, because the colour is decided once in
   * `lib/design/tokens.css` and this should not hold a second opinion about it.
   */
  tokens: string;
}

export const TOOLS: readonly Tool[] = [
  {
    id: "seating",
    href: "/seating",
    tokens: "tableaux-tokens",
    name: "Seating",
    tagline: "Build the room, then put people in it.",
    icon: Armchair,
  },
  {
    id: "place-cards",
    href: "/place-cards",
    tokens: "plaque-tokens",
    name: "Place cards",
    tagline: "Print-ready cards from the plan you just made.",
    icon: Contact,
  },
  {
    id: "timeline",
    href: "/timeline",
    tokens: "cadence-tokens",
    name: "Timeline",
    tagline: "The run of the day, and what collides.",
    icon: Clock,
  },
  {
    id: "delegation",
    href: "/delegation",
    tokens: "brigade-tokens",
    name: "Delegation",
    tagline: "The jobs, and the hands doing them.",
    icon: ClipboardList,
  },
  {
    id: "group-shots",
    href: "/group-shots",
    tokens: "ensemble-tokens",
    name: "Group shots",
    tagline: "The family photo list, built from who's who.",
    icon: Camera,
  },
];

/**
 * The wedding's own pages, as against the tools: views over the whole of it.
 * They sit under the wedding's name in the header, and each joins this list
 * as it is built.
 */
export interface WeddingPage {
  href: string;
  name: string;
  icon: LucideIcon;
}

export const WEDDING_PAGES: readonly WeddingPage[] = [
  { href: "/", name: "Overview", icon: LayoutDashboard },
  { href: "/guests", name: "Guests", icon: Users },
  { href: "/money", name: "Money", icon: Banknote },
  { href: "/checklist", name: "Checklist", icon: ListChecks },
  { href: "/binder", name: "Binder", icon: Smartphone },
];

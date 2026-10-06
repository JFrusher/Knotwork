import type { Knotwork } from "@jfrusher/knotwork";
import { ceremonyPlace } from "@/lib/ceremony/checks";
import { weddingGuestBlocks } from "@/lib/ceremony/guestCopy";
import { longDate } from "@/lib/dates";
import { formatClock } from "@/lib/minutes";
import { coupleTitle } from "@/lib/model/partners";
import { dayPlaces, readCeremony } from "@/lib/model/slices";
import { bookletRows, PAGE_COLUMN } from "../core/data/booklet";
import type { GuestRow } from "../core/data/rows";
import { makeResolveOptions } from "../core/template/resolve";
import { paginateService, typesetService } from "../core/template/service";
import type { LoadedFont } from "../core/text/measure";
import type { ServiceBlock, ServiceElement, Template } from "../core/types";

/** The columns a booklet's pages can print, besides the page's own: `{{Couple}}` on the cover. */
export const BOOKLET_COLUMNS = ["Couple", "Date", "Venue", "Time", "Officiant"] as const;

/** The wedding's facts a booklet prints, as one row. Empty where not known yet. */
export function bookletFacts(doc: Knotwork): GuestRow {
  const ceremony = readCeremony(doc);
  const { place } = ceremonyPlace(ceremony, dayPlaces(doc));
  return {
    Couple: coupleTitle(doc.event.partners) || doc.event.coupleNames,
    Date: doc.event.date ? longDate(doc.event.date) : "",
    Venue: place?.location || doc.event.venueName,
    Time: place ? formatClock(place.startMin) : "",
    Officiant: ceremony.officiant,
  };
}

/**
 * A booklet's pages, from the wedding: the cover, as many inside pages as the
 * order of service takes in its box, set in the faces loaded, and the back.
 */
export function bookletData(doc: Knotwork, template: Template, fonts: Map<string, LoadedFont>) {
  const service = weddingGuestBlocks(doc);
  const { rows, rowIds } = bookletRows(bookletFacts(doc), insidePages(template, service, fonts));
  // Which design a page is and which of the service it carries are for the engine; its number is the couple's.
  return { headers: [...BOOKLET_COLUMNS, PAGE_COLUMN], rows, rowIds, service };
}

/** The most inside pages any order of service on the design takes; none without one. */
function insidePages(template: Template, service: ServiceBlock[], fonts: Map<string, LoadedFont>): number {
  const measure = makeResolveOptions(fonts).measure!;
  const boxes = template.elements.filter((el): el is ServiceElement => el.kind === "service");
  return Math.max(0, ...boxes.map((el) => paginateService(typesetService(service, el, measure).lines, el.h).length));
}

/**
 * What a counted page view says about the page: its route, and nothing else.
 *
 * The hosted instance counts page views with Vercel Web Analytics, which
 * records the address it is given. Four pages carry something in their path
 * that is nobody else's business — a guest link, a supplier's link, an
 * invitation and a wedding's id — and any page can carry a query. So the
 * address is cut to the route before it leaves: the token becomes its name,
 * and everything after `?` or `#` goes. The Privacy Policy says exactly this.
 */
const PRIVATE_SEGMENTS: ReadonlyArray<[prefix: string, name: string]> = [
  ["/seat/", "[token]"],
  ["/supplier/", "[token]"],
  ["/invite/", "[token]"],
  ["/open/", "[wedding]"],
];

export function countedUrl(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const hidden = PRIVATE_SEGMENTS.find(([prefix]) => path.startsWith(prefix));
  return `${parsed.origin}${hidden ? `${hidden[0]}${hidden[1]}` : path}`;
}

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "vitest";
import { countedUrl, PUBLIC_ROUTES } from "./pageCounts";

test("a counted page view carries the route, never a link's token, a wedding's id, a query or a fragment", () => {
  expect(countedUrl("https://trousseau.app/seat/abc123#key")).toBe("https://trousseau.app/seat/[token]");
  expect(countedUrl("https://trousseau.app/supplier/def456#key")).toBe("https://trousseau.app/supplier/[token]");
  expect(countedUrl("https://trousseau.app/invite/0a1b2c")).toBe("https://trousseau.app/invite/[token]");
  expect(countedUrl("https://trousseau.app/open/7f3e-wedding")).toBe("https://trousseau.app/open/[wedding]");
  expect(countedUrl("https://trousseau.app/guests?select=g_42")).toBe("https://trousseau.app/guests");
  expect(countedUrl("https://trousseau.app/")).toBe("https://trousseau.app/");
  // Which post was read is worth knowing, and nobody's business to hide.
  expect(countedUrl("https://trousseau.app/blog/giving-notice-of-marriage")).toBe("https://trousseau.app/blog/giving-notice-of-marriage");
});

/** Every page route with a `[segment]` in it, as the address a browser would show. */
function dynamicPages(dir: string, app: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) return name === "page.tsx" && dir.includes("[") ? [relative(app, dir)] : [];
    return name === "api" ? [] : dynamicPages(path, app);
  });
}

test("no page whose address carries a token or an id is counted with it", () => {
  // A new page with a [segment] in its route fails here until countedUrl
  // cuts it, rather than sending its token with every visit.
  const app = join(process.cwd(), "app");
  const pages = dynamicPages(app, app);
  expect(pages.length).toBeGreaterThan(0);
  for (const page of pages.filter((route) => !PUBLIC_ROUTES.includes(route.split(sep).join("/")))) {
    const address = page
      .split(sep)
      .filter((part) => !/^\(.*\)$/.test(part))
      .map((part) => (part.startsWith("[") ? "secret" : part))
      .join("/");
    expect(countedUrl(`https://x.test/${address}`), page).not.toContain("secret");
  }
});

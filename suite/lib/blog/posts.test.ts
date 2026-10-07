import { expect, test } from "vitest";
import { emptyBar } from "@/lib/model/slices";
import { sumBar } from "@/lib/bar/sum";
import { GUESTS, TOOLS } from "@/lib/tools";
import { POSTS, postBySlug } from "./posts";

test("every post has its own address, and none is taken by a page of the blog's own", () => {
  const slugs = POSTS.map((post) => post.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  expect(slugs).not.toContain("share");
  for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  expect(postBySlug(slugs[0]!)).toBe(POSTS[0]);
});

test("every post says what it is in a search result's space, on a real date, newest first", () => {
  for (const post of POSTS) {
    expect(post.description.length, post.slug).toBeLessThanOrEqual(160);
    expect(Number.isNaN(new Date(post.published).getTime()), post.slug).toBe(false);
  }
  const dates = POSTS.map((post) => post.published);
  expect([...dates].sort().reverse()).toEqual(dates);
});

test("a guide's way into a tool is a tool that exists", () => {
  const hrefs = new Set([...TOOLS, GUESTS].map((tool) => tool.href as string));
  for (const post of POSTS) if (post.tool) expect(hrefs, post.slug).toContain(post.tool.href);
});

test("the drinks guide quotes what the Bar works out for 100, so the two cannot drift", () => {
  const buy = Object.fromEntries(sumBar(emptyBar(), 100).lines.map((line) => [line.line, line.buy]));
  const text = postBySlug("how-much-drink-for-a-uk-wedding")!.sections.flatMap((section) => section.paragraphs).join(" ");
  expect(text).toContain(`${buy.fizz} bottles of fizz`);
  expect(text).toContain(`${buy.white} of white wine and ${buy.red} of red`);
  expect(text).toContain(`${buy.beer! / 24} cases of beer`);
  expect(text).toContain(`${buy.spirits} bottles of spirits`);
  expect(text).toContain(`${buy.mixers} litres of mixers`);
  expect(text).toContain(`${buy.soft} litres of soft drinks`);
  expect(text).toContain(`${buy.ice} kilos of ice`);
});

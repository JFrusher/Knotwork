import { expect, test } from "@playwright/test";

/*
 * The blog is for people who have not opened Knotwork yet: found from a
 * search, read without a wedding in the browser, and one link from the tool
 * that does what the post describes.
 */
test("the blog lists its guides, and each is a page a search engine can read, with the way into its tool", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1, name: "Guides and stories" })).toBeVisible();
  await page.getByRole("link", { name: "How much drink to buy for a UK wedding" }).click();

  await expect(page).toHaveURL(/\/blog\/how-much-drink-for-a-uk-wedding$/);
  await expect(page.getByRole("heading", { level: 1, name: "How much drink to buy for a UK wedding" })).toBeVisible();
  await expect(page).toHaveTitle("How much drink to buy for a UK wedding · Knotwork");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/blog\/how-much-drink-for-a-uk-wedding$/);
  const article = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(article).toMatchObject({ "@type": "BlogPosting", headline: "How much drink to buy for a UK wedding", datePublished: "2026-09-29" });

  await page.getByRole("link", { name: "Work it out for your own guest list in Bar" }).click();
  await expect(page).toHaveURL(/\/bar$/);
});

test("an address that is not a post is not found, rather than an empty page", async ({ page }) => {
  const response = await page.goto("/blog/no-such-post");
  expect(response?.status()).toBe(404);
});

test("a couple can send their story by email, and is told what happens to it", async ({ page }) => {
  await page.goto("/blog/share");
  const email = page.getByRole("link", { name: "jacob@frusher.co.uk" });
  await expect(email).toHaveAttribute("href", /^mailto:jacob@frusher\.co\.uk\?subject=Our%20wedding%20story/);
  await expect(page.getByText("it goes up only once you say yes")).toBeVisible();
});

test("the blog is in the sitemap, post by post", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/blog</loc>");
  expect(sitemap).toContain("/blog/giving-notice-of-marriage</loc>");
});

for (const guide of [
  {
    slug: "the-family-photo-list",
    title: "The family photo list: who is in each shot, and in what order",
    tool: { link: "Make your own shot list in Group shots", url: /\/group-shots$/ },
  },
  {
    slug: "who-does-what-on-the-wedding-day",
    title: "Who does what on the wedding day, and how everyone knows",
    tool: { link: "Share out your own jobs in Delegation", url: /\/delegation$/ },
  },
  {
    slug: "import-your-guest-list-from-joy-zola-or-the-knot",
    title: "Bringing your guest list over from Joy, Zola or The Knot",
    tool: { link: "Import your own list in Guests", url: /\/guests$/ },
  },
  {
    slug: "print-your-own-place-cards",
    title: "How to print your own place cards",
    tool: { link: "Make your own place cards in Stationery", url: /\/stationery$/ },
  },
  {
    slug: "how-to-make-a-wedding-seating-chart",
    title: "How to make a wedding seating chart, and keep it up to date",
    tool: { link: "Draw your room and seat your guests in Seating", url: /\/seating$/ },
  },
  {
    slug: "a-wedding-day-timeline-you-can-move",
    title: "A wedding day timeline you can move",
    tool: { link: "Plan your own day in Timeline", url: /\/timeline$/ },
  },
]) {
  test(`the guide "${guide.title}" is listed, in the sitemap, and leads to its tool`, async ({ page, request }) => {
    await page.goto("/blog");
    await page.getByRole("link", { name: guide.title }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${guide.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: guide.title })).toBeVisible();
    await expect(page).toHaveTitle(`${guide.title} · Knotwork`);

    expect(await (await request.get("/sitemap.xml")).text()).toContain(`/blog/${guide.slug}</loc>`);

    await page.getByRole("link", { name: guide.tool.link }).click();
    await expect(page).toHaveURL(guide.tool.url);
  });
}

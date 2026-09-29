import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { POSTS } from "@/lib/blog/posts";
import { PRIVACY, TERMS } from "@/lib/legal";

/**
 * The pages worth indexing, which is not the same as the pages that exist:
 * the front page, the policies, and the blog, which is there to be found.
 *
 * The four tools are deliberately absent. They are an application rather than
 * a document — a crawler reaching /seating finds an empty editor, because the
 * wedding it would edit lives in a browser that is not the crawler's. And
 * /seat is excluded for the reason given in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, lastModified: PRIVACY.updated, changeFrequency: "yearly" },
    { url: `${base}/terms`, lastModified: TERMS.updated, changeFrequency: "yearly" },
    { url: `${base}/support`, changeFrequency: "yearly" },
    { url: `${base}/blog`, lastModified: POSTS[0]?.published, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/blog/share`, changeFrequency: "yearly" },
    ...POSTS.map((post) => ({ url: `${base}/blog/${post.slug}`, lastModified: post.published, changeFrequency: "yearly" as const, priority: 0.7 })),
  ];
}

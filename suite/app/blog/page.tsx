import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Guides and stories",
  description: "Plain guides to planning a UK wedding — drinks, notice of marriage, ceremony music, packing — and couples' own stories.",
  alternates: { canonical: "/blog" },
};

const dated = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Outside the app's route group, like the policies: anyone can read it, with
 * or without a wedding in their browser, and a search engine finds a page
 * rather than an empty editor.
 */
export default function Blog() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Trousseau</p>
      <h1 className="mt-3 text-3xl">Guides and stories</h1>
      <p className="mt-4 text-slate">
        Plain answers to the questions planning a UK wedding throws up, each checked against its sources — and stories from couples
        who have planned one.
      </p>

      <ol aria-label="Posts" className="mt-10 flex flex-col gap-8">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <p className="text-xs tracking-widest text-slate uppercase">
              {post.kind === "story" ? "A couple's story" : "A guide"} · <time dateTime={post.published}>{dated(post.published)}</time>
            </p>
            <h2 className="mt-1 text-xl">
              <Link href={`/blog/${post.slug}`} className="underline-offset-2 hover:underline">
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 text-slate">{post.description}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 rounded-lg border border-stone p-6">
        <h2 className="text-xl">Planned a wedding? Tell other couples how it went</h2>
        <p className="mt-2 text-slate">What worked, what you would do differently, and what nobody warned you about.</p>
        <p className="mt-4">
          <Link href="/blog/share" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
            Share your story
          </Link>
        </p>
      </section>

      <p className="mt-12 border-t border-stone pt-6 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
          Plan your wedding in Trousseau — free, and no account needed
        </Link>
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { POSTS, postBySlug } from "@/lib/blog/posts";

type Props = { params: Promise<{ slug: string }> };

/** Every post is built at build time; an address that is not a post is a 404, from the page itself. */
export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.published, authors: [post.author] },
  };
}

const dated = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function BlogPost({ params }: Props) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();

  // What a search engine reads as the article: its headline, date and author.
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    author: { "@type": post.author === "Trousseau" ? "Organization" : "Person", name: post.author },
    publisher: { "@type": "Organization", name: "Trousseau" },
    mainEntityOfPage: `${siteUrl()}/blog/${post.slug}`,
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article).replace(/</g, "\\u003c") }} />
      <p className="text-sm tracking-[0.14em] text-slate uppercase">
        <Link href="/blog" className="underline-offset-2 hover:underline">
          Guides and stories
        </Link>
      </p>
      <article>
        <h1 className="mt-3 text-3xl">{post.title}</h1>
        <p className="mt-2 text-sm text-slate">
          {post.author} · <time dateTime={post.published}>{dated(post.published)}</time>
        </p>

        {post.sections.map((section, index) => (
          <section key={index} className="mt-8">
            {section.heading && <h2 className="text-xl">{section.heading}</h2>}
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 text-slate">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        {post.tool && (
          <p className="mt-10 rounded-lg border border-gold/40 bg-gold/10 p-5">
            <Link href={post.tool.href} className="inline-flex min-h-11 items-center font-medium underline underline-offset-2">
              {post.tool.invitation} in {post.tool.name}
            </Link>
            <span className="block text-sm text-slate">Free, open source, and nothing leaves your browser unless you make an account.</span>
          </p>
        )}

        {post.sources.length > 0 && (
          <section className="mt-10 text-sm">
            <h2 className="text-base">Sources</h2>
            <ul className="mt-2 list-disc pl-5 text-slate">
              {post.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noopener" className="underline underline-offset-2 hover:text-charcoal">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <p className="mt-12 flex flex-wrap gap-x-6 border-t border-stone pt-6 text-sm">
        <Link href="/blog" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
          More guides and stories
        </Link>
        <Link href="/blog/share" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
          Share your story
        </Link>
      </p>
    </main>
  );
}

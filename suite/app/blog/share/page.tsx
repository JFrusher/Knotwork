import type { Metadata } from "next";
import Link from "next/link";
import { CONTROLLER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Share your story",
  description: "Planned a wedding? Tell other couples what worked, what you would change, and what nobody warned you about.",
  alternates: { canonical: "/blog/share" },
};

/** What to write about, as the email starts it. */
const PROMPTS = [
  "Where and when you married, as much or as little as you like",
  "The one decision you are gladdest you made",
  "What you would do differently",
  "What nobody warned you about",
  "Anything you made or did yourselves that other couples could borrow",
  "How you would like to be named: first names, initials, or not at all",
];

const mailto = `mailto:${CONTROLLER.email}?subject=${encodeURIComponent("Our wedding story, for the Knotwork blog")}&body=${encodeURIComponent(
  PROMPTS.map((prompt) => `${prompt}:\n\n`).join(""),
)}`;

/**
 * How a couple's story reaches the blog: by email, read by a person, and
 * published only as they agree. Nothing is collected by the site itself — a
 * form would mean storing strangers' stories and moderating them, which is a
 * decision of its own.
 */
export default function ShareYourStory() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">
        <Link href="/blog" className="underline-offset-2 hover:underline">
          Guides and stories
        </Link>
      </p>
      <h1 className="mt-3 text-3xl">Share your story</h1>
      <p className="mt-4 text-slate">
        The most useful thing a couple planning a wedding can read is how it went for someone who has just done it. If you have,
        other couples would like to hear it.
      </p>

      <section className="mt-8">
        <h2 className="text-xl">What to write about</h2>
        <ul className="mt-3 list-disc pl-5 text-slate">
          {PROMPTS.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
        <p className="mt-3 text-slate">A few paragraphs is plenty. Photographs are welcome, if everyone in them is happy to be shown.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">How</h2>
        <p className="mt-3 text-slate">
          Email it to{" "}
          <a href={mailto} className="underline underline-offset-2 hover:text-charcoal">
            {CONTROLLER.email}
          </a>
          . The link starts an email with the questions above in it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">What happens to it</h2>
        <p className="mt-3 text-slate">
          I read every one. Before anything goes up, I send you the page as it will be published, and it goes up only once you say
          yes. It carries the names you choose and never a guest&rsquo;s. You can ask for it to be changed or taken down at any time,
          and it will be. A story that is not published is deleted, not kept.
        </p>
      </section>

      <p className="mt-12 border-t border-stone pt-6 text-sm">
        <Link href="/blog" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
          Back to guides and stories
        </Link>
      </p>
    </main>
  );
}

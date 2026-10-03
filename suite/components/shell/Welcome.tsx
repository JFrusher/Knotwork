"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, FolderOpen, HandHeart, HardDrive, PenLine, Upload, UserRound, Users } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { TOOLS } from "@/lib/tools";
import { useTour } from "@/lib/tour/useTour";
import { loadExampleWedding } from "@/lib/tour/exampleWedding";
import { useConfirm } from "@/components/ui/Confirm";
import { useDataPanel } from "./dataPanel";
import { SignInFailed } from "./SignInFailed";

/**
 * The front page for someone with nothing in their wedding yet.
 *
 * The dashboard answers "where do things stand?", which on an empty wedding is
 * six cards saying "nothing yet" — the worst possible first impression, and
 * no answer to the question a new visitor actually has: what is this, and how
 * do I try it? So until there is anything in the wedding, this answers that
 * instead: what Knotwork does, and three ways in — start your own, look around
 * a finished one, or bring what you already have.
 *
 * Gone the moment anything is in the wedding, by whichever way in.
 */
export function Welcome() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <SignInFailed />

      <section aria-labelledby="welcome-heading" className="max-w-3xl">
        <p className="text-xs tracking-[0.18em] text-slate uppercase">Free · Open source · Private</p>
        <h1 id="welcome-heading" className="mt-4 font-display text-4xl leading-[1.1] text-charcoal sm:text-6xl">
          Plan the whole wedding in one place.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate sm:text-xl">
          Seat your guests and every place card already knows its table. Move the ceremony and the
          rest of the day moves with it. Eleven tools share one wedding, so nothing disagrees.
        </p>
      </section>

      <section aria-label="Ways to begin" className="mt-10 grid gap-4 md:grid-cols-3">
        <StartYourOwn />
        <ExploreTheExample />
        <BringWhatYouHave />
      </section>

      <ReturningVisitor />

      <ul aria-label="Promises" className="mt-10 grid gap-4 border-y border-charcoal/10 py-6 text-sm text-slate sm:grid-cols-3">
        <Pledge icon={HardDrive}>Your wedding stays in this browser unless you choose to sync it.</Pledge>
        <Pledge icon={UserRound}>No account needed. Open it and start.</Pledge>
        <Pledge icon={HandHeart}>Free for good: no ads, no paid tier, no upsell.</Pledge>
      </ul>

      <section aria-labelledby="inside-heading" className="mt-14">
        <h2 id="inside-heading" className="font-display text-2xl text-charcoal sm:text-3xl">
          Everything in one wedding
        </h2>
        <p className="mt-2 text-slate">
          Five tools are on from the start. Add the rest from the toolbox when you want them.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolTile icon={Users} name="Guests" tagline="The one list every other tool builds on." />
          {TOOLS.map((tool) => (
            <ToolTile key={tool.id} icon={tool.icon} name={tool.name} tagline={tool.tagline} />
          ))}
        </ul>
      </section>
    </div>
  );
}

const CARD = "flex flex-col rounded-lg border p-6";
const PRIMARY_ACTION =
  "mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded border border-gold bg-gold/15 px-4 py-2 text-sm font-medium text-charcoal transition hover:bg-gold/25 disabled:opacity-50";
const QUIET_ACTION =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded border border-charcoal/15 px-4 py-2 text-sm text-charcoal transition hover:border-gold disabled:opacity-50";

function CardHeading({ icon: Icon, children }: { icon: typeof Compass; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-2xl text-charcoal">
      <Icon size={20} className="shrink-0 text-gold" aria-hidden />
      {children}
    </h2>
  );
}

function StartYourOwn() {
  return (
    <div className={`${CARD} border-gold/50 bg-gold/10`}>
      <CardHeading icon={PenLine}>Start your wedding</CardHeading>
      <p className="mt-3 mb-6 text-slate">
        Your names, who is coming, then the room. A few minutes, and every tool has something to
        work with.
      </p>
      <Link href="/setup" className={PRIMARY_ACTION}>
        Set up your wedding <ArrowRight size={15} aria-hidden />
      </Link>
    </div>
  );
}

function ExploreTheExample() {
  const { startAll } = useTour();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explore() {
    setBusy(true);
    setError(null);
    try {
      if ((await loadExampleWedding(confirm)) === "loaded") startAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The example wedding could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${CARD} border-charcoal/10 bg-parchment`}>
      <CardHeading icon={Compass}>Explore an example</CardHeading>
      <p className="mt-3 mb-6 text-slate">
        Alex and Sam&rsquo;s wedding, planned end to end, with a short guided tour. Change anything,
        then start your own when you&rsquo;re ready.
      </p>
      <button type="button" onClick={() => void explore()} disabled={busy} className={`${QUIET_ACTION} mt-auto`}>
        {busy ? "Opening the example..." : "Explore the example wedding"}
      </button>
      {error && (
        <p role="alert" className="mt-3 rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
          {error}
        </p>
      )}
    </div>
  );
}

function BringWhatYouHave() {
  const showData = useDataPanel((s) => s.show);
  return (
    <div className={`${CARD} border-charcoal/10 bg-parchment`}>
      <CardHeading icon={Upload}>Bring what you have</CardHeading>
      <p className="mt-3 mb-6 text-slate">
        A guest list from Joy, Zola, The Knot or a spreadsheet, or a Knotwork file you saved
        before.
      </p>
      <div className="mt-auto flex flex-col gap-2">
        <Link href="/guests" className={QUIET_ACTION}>
          <Users size={15} aria-hidden /> Import a guest list
        </Link>
        <button type="button" onClick={showData} className={QUIET_ACTION}>
          <FolderOpen size={15} aria-hidden /> Open a saved file
        </button>
      </div>
    </div>
  );
}

/** Only where accounts exist: a link to a page saying "not set up here" helps nobody. */
function ReturningVisitor() {
  if (!browserClient()) return null;
  return (
    <p className="mt-6 text-sm text-slate">
      Already planning on another device?{" "}
      <Link href="/login" className="text-charcoal underline decoration-gold underline-offset-4 hover:decoration-charcoal">
        Sign in to carry on
      </Link>
    </p>
  );
}

function Pledge({ icon: Icon, children }: { icon: typeof Compass; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={17} className="mt-0.5 shrink-0 text-gold" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function ToolTile({ icon: Icon, name, tagline }: { icon: typeof Compass; name: string; tagline: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-charcoal/10 bg-parchment p-4">
      <Icon size={18} className="mt-0.5 shrink-0 text-slate" aria-hidden />
      <div>
        <p className="font-medium text-charcoal">{name}</p>
        <p className="mt-0.5 text-sm text-slate">{tagline}</p>
      </div>
    </li>
  );
}

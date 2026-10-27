// /guides/show-notes — ported from site/guides/show-notes.html at the same
// path, links updated to the new routes. The copy is already podcaster-neutral.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Complete Guide to Podcast Show Notes (2026) — EpisodeKit",
  description:
    "What show notes are for, the anatomy that works, the 5 mistakes hosts make, and how to write them fast — with a free template and a free generator.",
};

export default function GuideShowNotesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        The Complete Guide to Podcast Show Notes
      </h1>
      <p className="mt-2.5 text-sm text-faint">
        Everything that matters: what they&apos;re for, the anatomy that works, the mistakes, and
        the fastest honest ways to write them. ~7 min read.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <b>Jump to:</b> <a href="#why" className="text-accent hover:underline">Why they matter</a> ·{" "}
        <a href="#anatomy" className="text-accent hover:underline">The anatomy</a> ·{" "}
        <a href="#mistakes" className="text-accent hover:underline">5 mistakes</a> ·{" "}
        <a href="#seo" className="text-accent hover:underline">SEO realities (2026)</a> ·{" "}
        <a href="#speed" className="text-accent hover:underline">Writing them fast</a> ·{" "}
        <a href="#tools" className="text-accent hover:underline">The one-rule checklist</a>
      </div>

      <div className="mt-8 flex flex-col gap-7 text-[15px] leading-7 text-body">
        <section>
          <h2 id="why" className="mb-2 text-2xl font-semibold text-foreground">
            Why show notes matter more than ever
          </h2>
          <p className="mt-3">
            Show notes do four jobs at once. They let <b>skimmers</b> decide in ten seconds whether
            the episode is for them. They give <b>search engines</b> text to index — your audio is
            invisible to search, your notes are not. They give <b>guests</b> something to share (a
            link with their name and best line in it gets shared; a bare audio link does not). And
            they serve <b>accessibility</b>: deaf listeners and people who read faster than they
            listen.
          </p>
          <p className="mt-3">
            The pattern that emerged once AI tools started writing notes everywhere: readers now{" "}
            <i>scan for proof</i>. Generic notes that could describe any episode get discarded;
            notes that quote the episode word-for-word get trusted and clicked.
          </p>
        </section>

        <section>
          <h2 id="anatomy" className="mb-2 text-2xl font-semibold text-foreground">
            The anatomy that works
          </h2>
          <p className="mt-3">
            Six parts, in this order — the full copy-paste structure lives in our{" "}
            <Link href="/templates/show-notes" className="text-accent hover:underline">
              show notes template
            </Link>
            :
          </p>
          <ul className="mt-3 ml-5 list-disc space-y-2">
            <li>
              <b>Title as a promise</b> — &ldquo;Attention: the budget nobody manages&rdquo;, not
              &ldquo;Episode 47&rdquo;.
            </li>
            <li>
              <b>TL;DR first</b> — 2–3 sentences of payoff before any structure. Skimmers decide
              here.
            </li>
            <li>
              <b>Key moments with timestamps</b> — 5–8 entries, each headed by a claim, not a
              topic.
            </li>
            <li>
              <b>The takeaway</b> — the single most quotable idea, stated plainly.
            </li>
            <li>
              <b>Mentioned links</b> — only what was genuinely referenced.
            </li>
            <li>
              <b>About the guest</b> — one line, one link.
            </li>
          </ul>
        </section>

        <section>
          <h2 id="mistakes" className="mb-2 text-2xl font-semibold text-foreground">
            The five mistakes almost every show makes
          </h2>
          <ul className="mt-3 ml-5 list-disc space-y-2">
            <li>
              <b>Table-of-contents notes</b> — &ldquo;We discuss productivity&rdquo; describes every
              episode ever made. Say what&apos;s <i>claimed</i>.
            </li>
            <li>
              <b>Inventing quotes</b> — the fastest way to lose a guest&apos;s trust. If you quote,
              quote word-for-word (this is exactly what our{" "}
              <Link href="/tools/show-notes" className="text-accent hover:underline">
                free generator
              </Link>{" "}
              enforces architecturally).
            </li>
            <li>
              <b>Timestamps that promise nothing</b> — &ldquo;12:30 — we continue talking…&rdquo;
              earns no clicks.
            </li>
            <li>
              <b>Links dump</b> — 20 undifferentiated links is the same as zero.
            </li>
            <li>
              <b>Notes written for the host</b> — they&apos;re written for the person deciding
              whether to press play.
            </li>
          </ul>
        </section>

        <section>
          <h2 id="seo" className="mb-2 text-2xl font-semibold text-foreground">
            SEO realities in 2026
          </h2>
          <p className="mt-3">
            Two shifts matter. First, AI answer boxes compress informational clicks — but{" "}
            <b>episode pages with real quotes and timestamps still get cited and clicked</b>,
            because they&apos;re primary sources, not summaries. Second, search engines
            increasingly reward <b>unique text</b>: your transcript paraphrased generically is
            worth little; your best moments quoted exactly is worth a lot. (For a toolkit
            comparison of how the current tools approach this, see{" "}
            <Link href="/compare/podsqueeze" className="text-accent hover:underline">
              EpisodeKit vs Podsqueeze
            </Link>{" "}
            and{" "}
            <Link href="/compare/castmagic" className="text-accent hover:underline">
              vs Castmagic
            </Link>
            .)
          </p>
        </section>

        <section>
          <h2 id="speed" className="mb-2 text-2xl font-semibold text-foreground">
            Writing them fast — three honest speeds
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <div className="rounded-xl border-l-[3px] border-accent bg-surface p-4">
              <b>Manual (30–45 min):</b> use the{" "}
              <Link href="/templates/show-notes" className="text-accent hover:underline">template</Link>,
              pull your 6 best moments from the transcript, quote them exactly. Best
              quality-to-time ratio if you enjoy writing.
            </div>
            <div className="rounded-xl border-l-[3px] border-accent bg-surface p-4">
              <b>Generator (1 min):</b> paste your transcript into the{" "}
              <Link href="/tools/show-notes" className="text-accent hover:underline">
                free show notes generator
              </Link>{" "}
              — titled, sectioned notes where every line comes from what was actually said. No
              signup.
            </div>
            <div className="rounded-xl border-l-[3px] border-accent bg-surface p-4">
              <b>Full package (2 min):</b> one pass in the{" "}
              <Link href="/sign-up" className="text-accent hover:underline">EpisodeKit app</Link>{" "}
              produces all seven artifacts — show notes, chapters, summary, titles, blog post,
              newsletter and social posts.
            </div>
          </div>
        </section>

        <section>
          <h2 id="tools" className="mb-2 text-2xl font-semibold text-foreground">
            The one-rule checklist before you publish
          </h2>
          <ul className="mt-3 ml-5 list-disc space-y-2">
            <li>Could this title belong to any other episode? Rewrite it.</li>
            <li>Is the payoff in the first three sentences? Move it there.</li>
            <li>Is every quote word-for-word? Verify against the transcript.</li>
            <li>Would a skim-reader press play? If not, cut until they would.</li>
          </ul>
          <p className="mt-4">
            That&apos;s the whole game. Template{" "}
            <Link href="/templates/show-notes" className="text-accent hover:underline">here</Link>,
            generator{" "}
            <Link href="/tools/show-notes" className="text-accent hover:underline">here</Link> —
            both free.
          </p>
        </section>
      </div>
    </div>
  );
}

// /compare/podsqueeze + /compare/castmagic — ported from the legacy pages at
// the same paths. Product rows updated to the MVP facts (2 episodes free,
// $19 Pro, 7-artifact package + free tools); unverifiable third-party claims
// (Reddit attributions) removed per §0.5. Logged in DECISIONS.md.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPARE_SLUGS } from "@/lib/marketing/routes";

export function generateStaticParams(): Array<{ slug: (typeof COMPARE_SLUGS)[number] }> {
  return COMPARE_SLUGS.map((slug) => ({ slug }));
}

interface CompareContent {
  title: string;
  metaDescription: string;
  sub: string;
  rows: Array<[string, string, string]>;
  chooseThem: { h: string; p: React.ReactNode };
  chooseUs: { h: string; p: React.ReactNode };
  fact: string;
}

const US_INTRO = (
  <>
    EpisodeKit: Free (2 episodes/mo) · Pro $19/mo. Show notes, chapters, summary, titles, blog
    post, newsletter and social posts from one episode — plus free no-signup tools for
    discussion kits and email series. Every quote is copied word-for-word from your transcript.
  </>
);

const CONTENT: Record<(typeof COMPARE_SLUGS)[number], CompareContent> = {
  podsqueeze: {
    title: "EpisodeKit vs Podsqueeze — honest comparison (Oct 2026)",
    metaDescription:
      "EpisodeKit vs Podsqueeze for podcast show notes and content repurposing: pricing, approach, verbatim-quote integrity, and who each is right for. Facts as of October 2026.",
    sub: "Both turn podcast episodes into show notes and repurposed content. Here's the honest breakdown — including where Podsqueeze is the better choice.",
    rows: [
      ["Entry price", "Free (2 episodes/mo) · Pro $19/mo flat", "From ~$9/mo, tiered by uploads (see their pricing page)"],
      [
        "What it makes",
        "Show notes, chapters, summary, titles, blog post, newsletter, social posts — plus free no-signup tools for discussion kits and email series",
        "Show notes, clips, social posts, transcripts — a broad feature set",
      ],
      [
        "Quote integrity",
        "Verbatim-only: every quote in every artifact is an exact sentence from your transcript; paraphrased quotes are rejected automatically",
        "Standard AI generation",
      ],
      [
        "Works without an account",
        "Yes — free tools (show notes, titles, discussion kit, email series) with no signup",
        "No — account required",
      ],
      ["Audio upload", "Yes (browser-compressed) or paste transcript", "Yes, plus RSS import"],
      ["Video clips", "Not in the MVP", "Yes"],
      ["Positioning", "Small, sharp, honest — for indie shows and solo creators", "Established all-in-one repurposing suite"],
    ],
    chooseThem: {
      h: "Choose Podsqueeze if…",
      p: "you want an established all-in-one suite today — especially if video clips and RSS-based episode import are must-haves, or your workflow already lives in their tool. It's a real product that does a lot.",
    },
    chooseUs: {
      h: "Choose EpisodeKit if…",
      p: (
        <>
          you publish show notes, a blog or a newsletter and need artifacts beyond clips — and you
          care that every quote shown to your audience is word-for-word from the episode. Try it
          with no signup first:{" "}
          <Link href="/tools/show-notes" className="font-medium text-accent hover:underline">
            Generate show notes free →
          </Link>
        </>
      ),
    },
    fact: "Facts as of October 2026, from each product's public pricing page. Prices change — verify before buying. This page is written by the EpisodeKit maker; we've kept the trade-offs honest because a bad-fit customer churns anyway.",
  },
  castmagic: {
    title: "EpisodeKit vs Castmagic — honest comparison (Oct 2026)",
    metaDescription:
      "EpisodeKit vs Castmagic for podcast content repurposing: pricing, complexity, verbatim-quote integrity, and who each is right for. Facts as of October 2026.",
    sub: "Both generate content from podcast episodes. Castmagic is the bigger, older platform; EpisodeKit is the younger, sharper tool. Honest breakdown below.",
    rows: [
      ["Entry price", "Free (2 episodes/mo) · Pro $19/mo flat", "From ~$19/mo, tiering to enterprise-scale plans (see their pricing page)"],
      [
        "What it makes",
        "Seven artifacts, one flow: show notes, chapters, summary, titles, blog post, newsletter, social posts — plus free no-signup tools",
        "Many artifact types, custom prompts, chat, integrations — a large surface",
      ],
      ["Learning curve", "One screen per episode, paste and go", "Broader surface — more options to learn"],
      [
        "Quote integrity",
        "Verbatim-only; AI output that paraphrases a quote is rejected automatically",
        "Standard AI generation",
      ],
      ["Free without signup", "Yes — four single-artifact tools, no account", "Trial with account"],
      ["Custom prompts / pipelines", "Not in the MVP", "Yes, extensive"],
      ["Best for", "Indie shows, solo creators, newsletter-driven podcasts", "Production teams that want configurable pipelines and integrations"],
    ],
    chooseThem: {
      h: "Choose Castmagic if…",
      p: "you're a production team that lives in custom prompts, needs their integration breadth, or already has a workflow built there. Their depth of configuration is real.",
    },
    chooseUs: {
      h: "Choose EpisodeKit if…",
      p: (
        <>
          you want to paste an episode and get the whole package in one pass — and you&apos;ve been
          burned by AI tools inventing &ldquo;quotes&rdquo; your guests never said. Ours
          architecturally can&apos;t. Start free, no signup:{" "}
          <Link href="/tools/show-notes" className="font-medium text-accent hover:underline">
            Generate show notes free →
          </Link>
        </>
      ),
    },
    fact: "Facts as of October 2026, from each product's public pricing page. Prices change — verify before buying. Written by the EpisodeKit maker, trade-offs kept honest.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return {};
  return { title: CONTENT[slug].title, description: CONTENT[slug].metaDescription };
}

function isSlug(value: string): value is (typeof COMPARE_SLUGS)[number] {
  return (COMPARE_SLUGS as readonly string[]).includes(value);
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const c = CONTENT[slug];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        EpisodeKit vs {slug === "podsqueeze" ? "Podsqueeze" : "Castmagic"}
      </h1>
      <p className="mt-3 text-body">{c.sub}</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2 text-left">
              <th className="w-44 p-3 text-xs font-medium tracking-wide text-faint uppercase"> </th>
              <th className="p-3 text-xs font-medium tracking-wide text-accent uppercase">EpisodeKit</th>
              <th className="p-3 text-xs font-medium tracking-wide text-faint uppercase">
                {slug === "podsqueeze" ? "Podsqueeze" : "Castmagic"}
              </th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map(([label, us, them]) => (
              <tr key={label} className="border-t border-border align-top">
                <td className="p-3 text-faint">{label}</td>
                <td className="p-3">{us}</td>
                <td className="p-3 text-body">{them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[13px] text-faint">EpisodeKit plans and artifacts as described above: {US_INTRO}</p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold">{c.chooseThem.h}</h2>
          <p className="mt-1 text-body">{c.chooseThem.p}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold">{c.chooseUs.h}</h2>
          <p className="mt-1 text-body">{c.chooseUs.p}</p>
        </div>
      </div>

      <p className="mt-6 text-[13px] text-faint">{c.fact}</p>

      <p className="mt-8 text-sm text-body">
        {slug === "podsqueeze" ? (
          <Link href="/compare/castmagic" className="text-accent hover:underline">
            vs Castmagic →
          </Link>
        ) : (
          <Link href="/compare/podsqueeze" className="text-accent hover:underline">
            vs Podsqueeze →
          </Link>
        )}
      </p>
    </div>
  );
}

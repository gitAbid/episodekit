// /tools index — ported from site/tools/index.html (path + SEO copy).
import type { Metadata } from "next";
import Link from "next/link";
import { TOOL_DEFS } from "@/lib/tools/defs";

export const metadata: Metadata = {
  title: "Free Podcast Content Tools — EpisodeKit",
  description:
    "Free, no-signup tools for podcasters: show notes generator, episode title generator, discussion kit generator, and email series generator — all grounded in your actual transcript.",
};

const ORDER: Array<keyof typeof TOOL_DEFS> = [
  "show-notes",
  "episode-titles",
  "discussion-guide",
  "email-series",
];

const BLURB: Record<string, string> = {
  "show-notes":
    "Paste an episode → a titled, sectioned writeup for your episode page — structured show notes built from what was actually said.",
  "episode-titles":
    "Paste your transcript or notes → title ideas plus the themes your episode is actually about.",
  "discussion-guide":
    "Paste an episode → opener, warm-up questions, quote-anchored discussion questions, and action prompts for your community.",
  "email-series":
    "Paste an episode → a 5-day email drip, each day anchored on a real quote with reflection, action, and sign-off.",
};

export default function ToolsIndexPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Free tools for busy podcasters</h1>
      <p className="mt-3 text-body">
        No signup, no cost. Every tool runs on the same engine as the paid product — and every
        quote it shows you is taken word-for-word from the transcript you paste.
      </p>
      <div className="mt-8 flex flex-col gap-3.5">
        {ORDER.map((id) => {
          const def = TOOL_DEFS[id];
          return (
            <Link
              key={id}
              href={`/tools/${def.path}`}
              className="block rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
            >
              <h2 className="text-[17px] font-semibold">{def.h1}</h2>
              <p className="mt-1.5 text-[15px] leading-6 text-body">{BLURB[id]}</p>
              <span className="mt-3.5 inline-block text-sm font-semibold text-accent">Open tool →</span>
            </Link>
          );
        })}
      </div>
      <p className="mt-7 text-body">
        Want the whole package at once?{" "}
        <Link href="/pricing" className="text-accent hover:underline">
          That&apos;s EpisodeKit →
        </Link>{" "}
        · Comparing tools?{" "}
        <Link href="/compare/podsqueeze" className="text-accent hover:underline">
          vs Podsqueeze
        </Link>{" "}
        ·{" "}
        <Link href="/compare/castmagic" className="text-accent hover:underline">
          vs Castmagic
        </Link>
      </p>
    </div>
  );
}

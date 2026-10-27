// MK-1 Landing — copy verbatim from docs/relaunch/mockups/01-landing.html
// (the spec wins on conflicts). Fully static; the founding counter is the only
// server-side value and comes from the documented entitlements stub seam.
import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { FOUNDING_TOTAL } from "@/lib/billing/entitlements";
import { foundingRemainingForMarketing } from "@/lib/marketing/founding";

export const metadata: Metadata = {
  title: "EpisodeKit — Show notes that sound like you",
  description:
    "Upload an episode. Get show notes, chapters, a blog post, a newsletter and social posts in minutes — in your voice, with every quote checked against the audio.",
};

const PAINS = [
  {
    h3: "3 hours every Sunday",
    p: "Relistening, timestamping and writing show notes eats your weekend. EpisodeKit does it in minutes.",
  },
  {
    h3: "Generic AI copy",
    p: "Other tools sound like other tools. EpisodeKit learns your voice from your past show notes.",
  },
  {
    h3: "Misquoted guests",
    p: "Every quote is copied from the transcript and links to the exact moment in the audio.",
  },
] as const;

const STEPS = [
  {
    n: "1",
    h3: "Upload",
    p: "Drop your audio or paste a transcript from Riverside, Descript or Otter.",
  },
  { n: "2", h3: "Review in your voice", p: "Edit anything, regenerate a section, tick it ready." },
  {
    n: "3",
    h3: "Copy anywhere",
    p: "Formatted for Apple Podcasts, Spotify, YouTube, your blog and newsletter.",
  },
] as const;

const GETS = [
  { h3: "Show notes", p: "Hook, highlights, chapters, CTA." },
  { h3: "Chapters", p: "Timestamps in every platform's format." },
  { h3: "Summary", p: "One-liner, short and long." },
  { h3: "Titles", p: "8 options in labelled styles." },
  { h3: "Blog post", p: "SEO title, meta and slug included." },
  { h3: "Newsletter", p: "Three subject lines to pick from." },
  { h3: "Social posts", p: "LinkedIn, a thread and Instagram." },
  { h3: "Quotes", p: "Five verified pull quotes." },
] as const;

// FAQ written from real product facts only (§0.5: no invented claims). The two
// mockup answers that stated unshipped specifics (30-day audio deletion, 3–5
// minute runtime) are replaced with facts true of the shipped code — logged in
// DECISIONS.md 2026-10-27 · WP-09.
const FAQ = [
  {
    q: "Is my audio used to train AI?",
    a: "No. Your audio is stored privately for processing and is never used to train AI models. Transcripts stay in your account until you delete them.",
  },
  {
    q: "Which languages work?",
    a: "English for now.",
  },
  {
    q: "How do you check quotes?",
    a: "Quotes are copied from the transcript by position, never retyped by the AI.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, in two clicks from Billing. Your episodes stay.",
  },
  {
    q: "Do video podcasts work?",
    a: "Yes. Upload the video; we use its audio.",
  },
  {
    q: "What do I get from every episode?",
    a: "Show notes, chapters, a summary, 8 title options, a blog post, a newsletter and social posts — plus five verified quotes.",
  },
] as const;

export default async function LandingPage() {
  const foundingRemaining = await foundingRemainingForMarketing();
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col items-start gap-5">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            For podcast hosts
          </span>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-[40px]">
            Show notes that sound like you — and never misquote you.
          </h1>
          <p className="max-w-xl text-[17px] leading-7 text-body">
            Upload an episode. Get show notes, chapters, a blog post, a newsletter and social
            posts in minutes — in your voice, with every quote checked against the audio.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center justify-center rounded-md border border-accent bg-accent px-5 text-[15px] font-medium text-on-accent hover:bg-accent-hover"
            >
              Start free — 2 episodes/month
            </Link>
            <Link
              href="/samples"
              className="inline-flex h-12 items-center justify-center rounded-md px-5 text-[15px] font-medium text-body hover:bg-surface-2 hover:text-foreground"
            >
              See a real sample →
            </Link>
          </div>
          <p className="text-[13px] text-faint">No card required · Cancel anytime</p>
        </div>

        {/* Product preview (mockup content) */}
        <div className="overflow-hidden rounded-xl border border-border" aria-label="Product preview">
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
            <span className="text-[13px] font-semibold">Ep 42 · Attention is a budget</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Ready
            </span>
          </div>
          <div className="flex gap-4 border-b border-border px-4 text-[13px] font-medium text-faint">
            <span className="border-b-2 border-accent py-2.5 text-accent">Show notes</span>
            <span className="py-2.5">Summary</span>
            <span className="py-2.5">Titles</span>
            <span className="py-2.5">Blog post</span>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4 text-sm">
            <p>
              Focus is the most expensive resource in modern work, and almost nobody budgets it.
              This week: why one ping can tax a whole morning, and the calendar habit that fixes
              it.
            </p>
            <h3 className="text-[13px] font-semibold">In this episode</h3>
            <ul className="ml-4 list-disc space-y-1 text-[13px]">
              <li>Why attention compounds</li>
              <li>Calendars beat to-do lists</li>
              <li>Subtraction is the real upgrade</li>
            </ul>
            <blockquote className="border-l-[3px] border-accent pl-3">
              <p>
                “We budget our dollars, we calendar our hours, and then we let anyone with a
                notification spend our attention for free.”
              </p>
              <p className="mt-1 text-xs text-faint">
                — from the episode{" "}
                <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
                  ✓ Verified · 00:14
                </span>
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-t border-border py-12">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 md:grid-cols-3">
          {PAINS.map((pain) => (
            <div key={pain.h3}>
              <h2 className="text-base font-semibold">{pain.h3}</h2>
              <p className="mt-1 text-sm leading-6 text-body">{pain.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works + what you get */}
      <section className="border-t border-border py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4">
          <h2 className="text-xl font-semibold">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="rounded-xl border border-border p-4">
                <span className="mb-2 inline-grid size-7 place-items-center rounded-full bg-accent-soft text-[13px] font-medium text-accent">
                  {step.n}
                </span>
                <h3 className="text-base font-semibold">{step.h3}</h3>
                <p className="mt-1 text-sm leading-6 text-body">{step.p}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-4 text-xl font-semibold">What you get from every episode</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {GETS.map((item) => (
              <div key={item.h3} className="rounded-xl border border-border p-4">
                <h3 className="text-base font-semibold">{item.h3}</h3>
                <p className="mt-1 text-sm leading-6 text-body">{item.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote check */}
      <section className="border-t border-border py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4">
          <h2 className="text-xl font-semibold">Every quote is checked</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                <CheckIcon aria-hidden className="size-3" /> Kept — exact words at 07:40
              </span>
              <p>
                “Calendars beat to-do lists because a to-do item is a wish while a calendar block
                is a promise.”
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
                <XIcon aria-hidden className="size-3" /> Rejected — not in the transcript
              </span>
              <p className="text-faint line-through">
                “To-do lists are wishes; calendars are promises you keep.”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4">
          <h2 className="text-xl font-semibold">Simple pricing</h2>
          <div className="grid w-full justify-center gap-4 sm:grid-cols-2 sm:max-w-[720px]">
            <div className="flex flex-col gap-3 rounded-xl border border-border p-6">
              <span className="font-semibold">Free</span>
              <span className="text-[32px] font-semibold leading-none">$0</span>
              <ul className="ml-4 list-disc space-y-1 text-sm text-body">
                <li>2 episodes a month</li>
                <li>Up to 60 minutes each</li>
                <li>All 7 pieces of content</li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-auto inline-flex h-10 items-center justify-center rounded-md border border-border-strong bg-background text-sm font-medium hover:bg-surface-2"
              >
                Start free
              </Link>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-accent p-6 ring-1 ring-accent">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Pro</span>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                  Most popular
                </span>
              </div>
              <span className="text-[32px] font-semibold leading-none">
                $19<span className="text-sm font-normal text-faint">/month</span>
              </span>
              <ul className="ml-4 list-disc space-y-1 text-sm text-body">
                <li>10 episodes a month</li>
                <li>Up to 2 hours each</li>
                <li>No EpisodeKit footer</li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-auto inline-flex h-10 items-center justify-center rounded-md border border-accent bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover"
              >
                Get Pro
              </Link>
            </div>
          </div>
          <p className="text-sm">
            Founding Pro: <span className="font-semibold">$99/year</span>, price locked for life
            {foundingRemaining == null ? (
              " · first 100 only"
            ) : (
              <>
                {" · "}
                <span className="font-mono tabular-nums">{foundingRemaining}</span> of{" "}
                {FOUNDING_TOTAL} left
              </>
            )}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4">
          <h2 className="text-xl font-semibold">Questions</h2>
          <div className="grid gap-x-8 md:grid-cols-2">
            {FAQ.map((item) => (
              <details key={item.q} className="border-b border-border py-3">
                <summary className="cursor-pointer font-medium">{item.q}</summary>
                <p className="mt-2 text-sm leading-6 text-body">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

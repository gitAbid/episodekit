// /guides/repurposing — ported from site/guides/repurposing.html at the same
// path, links updated to the new routes.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Podcast Repurposing Playbook (2026) — EpisodeKit",
  description:
    "How to turn one episode into a month of content without burning out: the priority order, the batch workflow, the verbatim rule, and the tools.",
};

export default function GuideRepurposingPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        The Podcast Repurposing Playbook
      </h1>
      <p className="mt-2.5 text-sm text-faint">
        One episode, a month of content — without a content team. The priority order, the batch
        workflow, and the rules that keep it honest. ~6 min read.
      </p>

      <div className="mt-8 flex flex-col gap-7 text-[15px] leading-7 text-body">
        <section>
          <h2 className="mb-2 text-2xl font-semibold text-foreground">
            The math nobody tells solo podcasters
          </h2>
          <p>
            A weekly 45-minute episode contains roughly 6,000 spoken words — more than most people
            write in a week. Nearly all of it evaporates. Repurposing isn&apos;t making
            &ldquo;extra&rdquo; content; it&apos;s <b>rescuing content you already made</b>. Done
            even partially, one episode yields: an episode-page writeup, a newsletter, a 5-day
            email drip, 3–6 social posts with quotes, a community discussion prompt, and title
            options for the clip cuts. That&apos;s 15–20 assets, most of them derived, not written.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold text-foreground">
            Priority order (when you can&apos;t do it all)
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs tracking-wide text-accent uppercase">
                  <th className="p-3">Asset</th>
                  <th className="p-3">Effort</th>
                  <th className="p-3">Return</th>
                  <th className="p-3">Do it if…</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Show notes / episode page", "Medium", "Compounding (search)", "Always — it's the anchor everything links to"],
                  ["Newsletter issue", "Low", "Highest (owned audience)", "You have any list at all"],
                  ["2–3 quote posts", "Very low", "Reach + guest shares", "Always — guests reshare their own best lines"],
                  ["Community discussion prompts", "Low", "Retention", "You have a Discord/Patreon/group"],
                  ["5-day email drip", "Medium", "Onboarding new subscribers for months", "List > ~500"],
                  ["Video clips", "High", "Volatile", "You have video source + editing time"],
                ].map(([asset, effort, ret, when]) => (
                  <tr key={asset} className="border-t border-border align-top">
                    <td className="p-3">{asset}</td>
                    <td className="p-3">{effort}</td>
                    <td className="p-3">{ret}</td>
                    <td className="p-3">{when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold text-foreground">The verbatim rule</h2>
          <div className="mt-3 rounded-xl border-l-[3px] border-accent bg-surface p-4">
            Whatever tool writes your repurposed assets:{" "}
            <b>quotes must be word-for-word from the transcript.</b> A fabricated &ldquo;quote&rdquo;
            shared publicly by a guest is the fastest way to burn a relationship — and it&apos;s the
            most common complaint about AI repurposing tools. Our{" "}
            <Link href="/tools/show-notes" className="text-accent hover:underline">generator</Link>{" "}
            enforces this architecturally: AI-paraphrased quotes are rejected at generation time.
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold text-foreground">
            The batch workflow (one focused hour per episode)
          </h2>
          <ol className="mt-3 ml-5 list-decimal space-y-2">
            <li>
              <b>Transcript ready</b> (your usual ASR; or paste it).
            </li>
            <li>
              <b>Pull the 6 best moments</b> — claims, numbers, stories. These become your quotes
              and timestamps.
            </li>
            <li>
              <b>Write the notes</b> around them —{" "}
              <Link href="/templates/show-notes" className="text-accent hover:underline">template here</Link>,
              full anatomy in the{" "}
              <Link href="/guides/show-notes" className="text-accent hover:underline">show notes guide</Link>.
            </li>
            <li>
              <b>Derive the rest</b>: newsletter = summary + one quote; social = quote + link;
              community = 3 questions; drip = 5 moments, one per day.
            </li>
            <li>
              <b>Schedule once</b>, then leave it alone. Batching beats dripping your own attention
              all week.
            </li>
          </ol>
          <p className="mt-3">
            Steps 2–4 are exactly what the{" "}
            <Link href="/sign-up" className="text-accent hover:underline">EpisodeKit app</Link>{" "}
            automates — all seven artifact families from one episode — but the playbook works by
            hand too; the tools are speed, not magic.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold text-foreground">Choosing tools honestly</h2>
          <p>
            All-in-one suites (Podsqueeze, Castmagic) are real products with broad feature sets;
            the common trade-offs are price tiers and generic-feeling output. Ours trades breadth
            for the verbatim guarantee and a no-signup floor. The honest comparisons:{" "}
            <Link href="/compare/podsqueeze" className="text-accent hover:underline">vs Podsqueeze</Link>{" "}
            ·{" "}
            <Link href="/compare/castmagic" className="text-accent hover:underline">vs Castmagic</Link>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold text-foreground">The one-metric check</h2>
          <p>
            Each month, ask: <b>which repurposed asset actually got clicked?</b> Kill the rest
            without guilt. The playbook survives contact with your audience only if you prune it.
          </p>
          <p className="mt-4">
            Start with the free{" "}
            <Link href="/tools/show-notes" className="text-accent hover:underline">
              show notes generator
            </Link>{" "}
            — paste a transcript, no signup — or grab the{" "}
            <Link href="/templates/show-notes" className="text-accent hover:underline">template</Link>{" "}
            and do it by hand.
          </p>
        </section>
      </div>
    </div>
  );
}

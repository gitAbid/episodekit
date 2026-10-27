// §5.4 /terms — plain factual boilerplate for the MVP. No invented legal
// entities or addresses (§0.5); billing is via Lemon Squeezy as merchant of
// record once the store is live.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — EpisodeKit",
  description: "The plain terms of using EpisodeKit: your content, your plan, cancellation.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Terms</h1>
      <p className="mt-2 text-sm text-faint">Plain language, last updated October 2026.</p>

      <div className="mt-8 flex flex-col gap-6 text-[15px] leading-7 text-body">
        <section>
          <h2 className="text-base font-semibold text-foreground">Your content</h2>
          <p>
            You own everything you upload and everything EpisodeKit generates for you. You can
            edit, copy and export it at any time. We only process it to produce your content.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
          <p>
            Upload only audio and transcripts you have the right to use. Don&apos;t use EpisodeKit to
            infringe anyone&apos;s rights or to break the law.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Plans and billing</h2>
          <p>
            The Free plan includes 2 episodes a month. Pro is $19/month with 10 episodes a month.
            Founding Pro is $99/year for the first 100 customers, price locked for life.
            Payments are handled by Lemon Squeezy as merchant of record; applicable taxes are
            included in their checkout.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Cancellation</h2>
          <p>
            Cancel in two clicks from Settings → Billing. You keep access until the end of the
            paid period, and your episodes stay.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Availability and AI limits</h2>
          <p>
            EpisodeKit works with English episodes. AI output can contain mistakes — quotes are
            checked against your transcript, but review your content before publishing. The
            service is provided as-is, without warranties to the extent permitted by law.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>EpisodeKit — contact: the owner email configured for this deployment (OWNER_EMAILS).</p>
        </section>
      </div>
    </div>
  );
}

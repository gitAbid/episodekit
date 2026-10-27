// §5.4 /privacy — plain factual boilerplate describing the ACTUAL data flows
// shipped in this codebase. No invented company addresses (§0.5); contact is
// the owner email configured in the OWNER_EMAILS env var.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — EpisodeKit",
  description:
    "What EpisodeKit stores: your account email, episodes and transcripts, and the third-party services used to run the product.",
};

const SERVICES = [
  ["Hosting", "Vercel — serves the app and stores uploaded audio in private Blob storage."],
  ["Sign-in", "Clerk — your email address (and Google account, if you use Google sign-in)."],
  ["Database", "Neon Postgres — your account, show, episodes, transcripts and generated content."],
  ["Transcription", "Groq — audio you upload is sent to Groq's Whisper API to produce the transcript."],
  [
    "Writing",
    "The AI provider configured for the product (see the AI providers list on this page) receives the transcript to write your content.",
  ],
  ["Payments", "Lemon Squeezy — processes subscriptions. We see your email and plan status."],
  ["Analytics", "PostHog — product events and the feedback you submit. Loaded only when analytics is configured."],
  ["Email", "Resend — sends the 'package ready' email and magic-link sign-in emails."],
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-faint">Plain language, last updated October 2026.</p>

      <div className="mt-8 flex flex-col gap-6 text-[15px] leading-7 text-body">
        <section>
          <h2 className="text-base font-semibold text-foreground">What we store</h2>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>Your account: email address and name from Clerk sign-in.</li>
            <li>Your show: name, artwork and links you enter, plus voice samples you paste.</li>
            <li>
              Episodes: the audio or transcript you upload, the transcript produced from it, and
              the content generated for it. Audio is stored privately and only used to produce
              your package.
            </li>
            <li>Feedback you send us, including your note and which artifact it was about.</li>
          </ul>
          <p className="mt-2">
            Your audio is not used to train AI models. Transcripts and content stay in your
            account until you delete the episode.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Services we use</h2>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            {SERVICES.map(([name, what]) => (
              <li key={name}>
                <span className="font-medium text-foreground">{name}:</span> {what}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">What we never do</h2>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>Sell your data.</li>
            <li>Send marketing you didn&apos;t ask for.</li>
            <li>Let AI providers train on your content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Deleting your data</h2>
          <p>
            Deleting an episode removes its audio, transcript and content. To delete your account,
            contact us and we will remove everything.
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

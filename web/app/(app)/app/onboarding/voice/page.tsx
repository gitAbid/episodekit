import Link from "next/link";
import { StepDots } from "@/components/app/step-dots";

export const metadata = { title: "Onboarding · EpisodeKit" };

/**
 * Step 2 placeholder — the voice-learning UI ships in WP-07 (U3).
 * The route exists so the onboarding flow is complete end to end.
 */
export default function OnboardingVoicePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-10">
      <StepDots step={2} />
      <div className="w-full rounded-lg border p-6 text-center" data-testid="voice-placeholder">
        <h1 className="text-lg font-semibold">Teach EpisodeKit your voice</h1>
        <p className="mt-2 text-sm text-neutral-500">This page is coming soon.</p>
        <Link
          href="/app/onboarding/first"
          className="mt-4 inline-block text-sm underline"
          data-testid="skip-voice"
        >
          Skip for now
        </Link>
      </div>
    </div>
  );
}

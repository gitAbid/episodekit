import { Suspense } from "react";
import Link from "next/link";
import { EpisodeIntakeShell } from "@/components/app/episode-intake-shell";
import { StepDots } from "@/components/app/step-dots";

export const metadata = { title: "Onboarding · EpisodeKit" };

/** Onboarding step 3 shell (M1): the first episode. Intake is WP-05/06. */
export default function OnboardingFirstPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-10">
      <StepDots step={3} />
      <div className="w-full rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Add your first episode</h1>
        <p className="mt-1 text-sm text-neutral-500">
          You can do this later from Episodes.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-neutral-100" />}>
            <EpisodeIntakeShell />
          </Suspense>
        </div>
        <div className="mt-6 text-right">
          <Link href="/app" className="text-sm underline" data-testid="skip-first">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}

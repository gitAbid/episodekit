import { redirect } from "next/navigation";
import { VoiceOnboardingForm } from "@/components/app/onboarding/voice-form";
import { StepDots } from "@/components/app/step-dots";
import { requireUser } from "@/lib/auth";
import { isDbConfigured } from "@/lib/env";
import { getShowByOwnerSafe } from "@/lib/show/queries-safe";

export const metadata = { title: "Teach EpisodeKit your voice · EpisodeKit" };

/** Onboarding step 2 (M1): voice samples → profile (U3, MK-2). */
export default async function OnboardingVoicePage() {
  const userId = await requireUser();
  const show = await getShowByOwnerSafe(userId);
  if (!show && isDbConfigured()) redirect("/app/onboarding/show");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-10">
      <StepDots step={2} />
      <div className="w-full rounded-lg border p-6">
        <VoiceOnboardingForm />
      </div>
    </div>
  );
}

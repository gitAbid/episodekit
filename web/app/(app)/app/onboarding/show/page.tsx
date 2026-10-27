import { redirect } from "next/navigation";
import { ShowOnboardingForm } from "@/components/app/onboarding/show-form";
import { StepDots } from "@/components/app/step-dots";
import { requireUser } from "@/lib/auth";
import { getShowByOwnerSafe } from "@/lib/show/queries-safe";

export const metadata = { title: "Set up your show · EpisodeKit" };

/** Onboarding step 1 (M1): show name + optional RSS prefill (U2). */
export default async function OnboardingShowPage() {
  const userId = await requireUser();
  const existing = await getShowByOwnerSafe(userId);
  if (existing) redirect("/app/episodes");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-10">
      <StepDots step={1} />
      <div className="w-full rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Set up your show</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Only the name is needed. You can change everything later.
        </p>
        <div className="mt-6">
          <ShowOnboardingForm />
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { VoiceSettingsForm } from "@/components/app/settings/voice-form";
import { requireUser } from "@/lib/auth";
import { isDbConfigured } from "@/lib/env";
import { getShowByOwnerSafe } from "@/lib/show/queries-safe";
import { resolveShowVoiceProfile } from "@/lib/show/voice";

export const metadata = { title: "Settings · EpisodeKit" };

/** Settings → Voice (M9, MK-8): §7.4 profile editor, samples, preview. */
export default async function SettingsVoicePage() {
  const userId = await requireUser();
  const show = await getShowByOwnerSafe(userId);
  if (!show && isDbConfigured()) redirect("/app/onboarding/voice");
  return (
    <VoiceSettingsForm
      profile={resolveShowVoiceProfile(show)}
      samples={show?.voiceSamples ?? []}
    />
  );
}

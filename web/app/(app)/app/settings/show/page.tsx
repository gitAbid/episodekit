import { redirect } from "next/navigation";
import { ShowSettingsForm } from "@/components/app/settings/show-form";
import { requireUser } from "@/lib/auth";
import { isDbConfigured } from "@/lib/env";
import { getShowByOwnerSafe } from "@/lib/show/queries-safe";

export const metadata = { title: "Settings · EpisodeKit" };

/** Settings General (M9): name, artwork URL, listen link, default CTA, vocabulary. */
export default async function SettingsShowPage() {
  const userId = await requireUser();
  const show = await getShowByOwnerSafe(userId);
  if (!show && isDbConfigured()) {
    redirect("/app/onboarding/show");
  }
  return (
    <ShowSettingsForm
      show={{
        name: show?.name ?? "",
        artworkUrl: show?.artworkUrl ?? "",
        listenUrl: show?.listenUrl ?? "",
        defaultCta: show?.defaultCta ?? "",
        vocabulary: show?.vocabulary ?? [],
      }}
    />
  );
}

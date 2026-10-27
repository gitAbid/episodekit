import { Suspense } from "react";
import { EpisodeIntakeShell } from "@/components/app/episode-intake-shell";

export const metadata = { title: "New episode · EpisodeKit" };

export default function NewEpisodePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">New episode</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-neutral-100" />}>
        <EpisodeIntakeShell />
      </Suspense>
    </div>
  );
}

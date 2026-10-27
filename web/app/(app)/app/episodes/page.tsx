import Link from "next/link";

export const metadata = { title: "Episodes · EpisodeKit" };

/** Empty state per MK-3; the episodes list ships in WP-06 (M8). */
export default function EpisodesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Episodes</h1>
      <div className="rounded-lg border p-8 text-center" data-testid="episodes-empty">
        <p className="font-medium">No episodes yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Upload your first episode and get a full content package in minutes.
        </p>
        <Link
          href="/app/episodes/new"
          className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white"
        >
          New episode
        </Link>
      </div>
    </div>
  );
}

// MK-5/MK-6: processing and workspace share this URL; the client view drives
// the pipeline and polls until terminal (§7.5). Dynamic per-user data is
// streamed behind Suspense (Next 16 cacheComponents).
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getShowByOwner } from "@/db/queries";
import { handleEpisodeWithArtifactsGet } from "@/lib/pipeline/service";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export default function EpisodeWorkspacePage({ params }: PageProps<"/app/episodes/[id]">) {
  return (
    <Suspense
      fallback={
        <div data-workspace className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground" data-testid="workspace-loading">
          Loading your workspace…
        </div>
      }
    >
      <WorkspaceContent params={params} />
    </Suspense>
  );
}

async function WorkspaceContent({ params }: { params: Promise<{ id: string }> }) {
  // Per-user episode data — request-time rendering.
  await connection();
  const userId = await requireUser();
  const { id } = await params;

  const result = await handleEpisodeWithArtifactsGet(userId, id);
  if (result.status !== 200) {
    return (
      <div data-workspace className="flex flex-1 flex-col items-center gap-2 p-10 text-center">
        <h1 className="text-lg font-semibold">Episode not found</h1>
        <Link href="/app/episodes" className="text-sm text-[var(--accent)]">
          Back to episodes
        </Link>
      </div>
    );
  }

  const data = result.json as unknown as import("@/lib/pipeline/client").WorkspaceData;
  const show = await getShowByOwner(userId);

  return <WorkspaceView initial={data} freePlan={data.freePlan} showName={show?.name ?? "Your show"} />;
}

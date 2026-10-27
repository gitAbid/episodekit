import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleEpisodeWithArtifactsGet } from "@/lib/pipeline/service";

/** GET /api/episodes/:id/workspace — episode + artifacts + analysis + segments
 *  for the workspace view; polled while not terminal (§7.5). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id } = await params;
  const result = await handleEpisodeWithArtifactsGet(userId, id);
  return Response.json(result.json, { status: result.status });
}

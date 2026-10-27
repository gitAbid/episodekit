import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleEpisodeGet } from "@/lib/episodes/service";

/** GET /api/episodes/:id — episode + status, polled every 2 s (§7.5, U4). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id } = await params;
  const result = await handleEpisodeGet(userId, id);
  return Response.json(result.json, { status: result.status });
}

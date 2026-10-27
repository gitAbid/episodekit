import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleAudioGet } from "@/lib/episodes/service";

/** GET /api/audio/:episodeId — short-lived signed URL for playback (§7.5). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id } = await params;
  const tParam = new URL(req.url).searchParams.get("t");
  const tMs = tParam !== null && /^\d+$/.test(tParam) ? Number(tParam) : 0;
  const result = await handleAudioGet(userId, id, tMs);
  return Response.json(result.json, { status: result.status });
}

import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleEpisodesPost } from "@/lib/episodes/service";

/** POST /api/episodes — create an episode from upload/paste/sample (§7.5). */
export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleEpisodesPost(userId, body);
  return Response.json(result.json, { status: result.status });
}

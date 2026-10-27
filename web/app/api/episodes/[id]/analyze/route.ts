import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleAnalyzePost } from "@/lib/pipeline/service";

/** POST /api/episodes/:id/analyze — chapters/topics/candidate quotes (§7.5). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id } = await params;
  const result = await handleAnalyzePost(userId, id);
  return Response.json(result.json, { status: result.status });
}

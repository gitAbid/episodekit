import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleArtifactGeneratePost } from "@/lib/pipeline/service";

export const maxDuration = 300;

/** POST /api/episodes/:id/artifacts/:kind/generate — one artifact (§7.5). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id, kind } = await params;
  const body: unknown = await req.json().catch(() => ({}));
  const result = await handleArtifactGeneratePost(userId, id, kind, body);
  return Response.json(result.json, { status: result.status });
}

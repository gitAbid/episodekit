import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleArtifactPatch } from "@/lib/pipeline/service";

/** PATCH /api/artifacts/:id — {content} save · {ready} · {undo:true} (§7.5). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id } = await params;
  const body: unknown = await req.json().catch(() => ({}));
  const result = await handleArtifactPatch(userId, id, body);
  return Response.json(result.json, { status: result.status });
}

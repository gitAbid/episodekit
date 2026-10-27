import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleTranscribePost } from "@/lib/episodes/service";

// Groq chunked transcription of a 2 h episode must not hit the function
// timeout (§7.5: maxDuration 300).
export const maxDuration = 300;

/** POST /api/episodes/:id/transcribe — upload→queued→transcribing→queued (§8.3). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const { id } = await params;
  const body: unknown = await req.json().catch(() => ({}));
  const result = await handleTranscribePost(userId, id, body);
  return Response.json(result.json, { status: result.status });
}

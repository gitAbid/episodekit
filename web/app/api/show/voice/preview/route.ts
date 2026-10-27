// §7.5 POST /api/show/voice/preview — Settings → Voice preview (M9/MK-8).
import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleVoicePreview } from "@/lib/show/voice";

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleVoicePreview(userId, body);
  return Response.json(result.json, { status: result.status });
}

// §7.5 POST /api/show/voice/learn — onboarding step 2 (U3).
import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleVoiceLearn } from "@/lib/show/voice";

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleVoiceLearn(userId, body);
  return Response.json(result.json, { status: result.status });
}

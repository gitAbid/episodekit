import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleRssPreview } from "@/lib/rss/preview";

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleRssPreview(body);
  return Response.json(result.json, { status: result.status });
}

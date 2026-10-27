import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleUploadsTokenPost } from "@/lib/episodes/service";

/** POST /api/uploads/token — @vercel/blob client-upload token (§7.5). */
export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const result = await handleUploadsTokenPost(userId, req);
  return Response.json(result.json, { status: result.status });
}

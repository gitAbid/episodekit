import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { handleShowPatch, handleShowPost } from "@/lib/show/service";

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleShowPost(userId, body);
  return Response.json(result.json, { status: result.status });
}

export async function PATCH(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleShowPatch(userId, body);
  return Response.json(result.json, { status: result.status });
}

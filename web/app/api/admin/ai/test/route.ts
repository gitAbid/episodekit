// §7.5 — POST /api/admin/ai/test (owner only): tiny prompt through the current
// (or body-specified) provider; returns OK/latency/usage or the error.
import { adminAiTest, type AdminTestBody } from "@/lib/ai/admin";
import { resolveAppSettingsStore } from "@/lib/ai/settings-server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as AdminTestBody;
  const res = await adminAiTest({ store: resolveAppSettingsStore() }, body);
  return Response.json(res.body, { status: res.status });
}

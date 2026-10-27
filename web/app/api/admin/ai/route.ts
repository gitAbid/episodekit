// §7.5 — GET/PUT /api/admin/ai (owner only, M13). Thin wrappers over the
// framework-free handlers in lib/ai/admin.ts. The app_settings store arrives
// through the documented WP-02 seam; until the DB layer lands, PUT returns 503
// and GET serves the env/default view.
import { adminAiGet, adminAiPut } from "@/lib/ai/admin";
import { resolveAppSettingsStore } from "@/lib/ai/settings-server";


export async function GET() {
  const res = await adminAiGet({ store: resolveAppSettingsStore() });
  return Response.json(res.body, { status: res.status });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await adminAiPut({ store: resolveAppSettingsStore() }, body);
  return Response.json(res.body, { status: res.status });
}

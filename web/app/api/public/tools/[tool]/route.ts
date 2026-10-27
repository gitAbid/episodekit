// §7.5 POST /api/public/tools/:tool (public) — free tools: BotID + 5/day/IP +
// global daily cost cap; real LLM through the lib/ai registry, deterministic
// engine fallback with the honest note. No auth, no quota (M12).
import { NextResponse } from "next/server";
import { isToolId } from "@/lib/tools/defs";
import { verifyHuman } from "@/lib/tools/botid";
import { consumeDaily } from "@/lib/tools/rate-limit";
import { capStatus, memorySpendStore, type FreeToolSpendStore } from "@/lib/tools/cost-cap";
import { dbSpendStore } from "@/lib/tools/spend-db";
import { CAP_NOTE, checkToolInput, runFreeTool } from "@/lib/tools/run";
import { consoleUsageLogger, type UsageEvent } from "@/lib/ai/usage";

const DAILY_IP_LIMIT = 5;

// Per-instance fallback when DATABASE_URL is absent (keyless preview): better
// than a fresh store per request, still not shared state — the real cap needs
// the DB row. Documented in DECISIONS.md 2026-10-27 · WP-09.
const instanceSpendStore = memorySpendStore();

export async function POST(request: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  if (!isToolId(tool)) {
    return NextResponse.json({ error: "unknown_tool" }, { status: 404 });
  }

  // 1) BotID (fail-open on infra failure — see lib/tools/botid.ts)
  const bot = await verifyHuman(request);
  if (bot.blocked) {
    return NextResponse.json({ error: "bot_detected" }, { status: 403 });
  }

  // 2) 5/day/IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rl = consumeDaily(ip, DAILY_IP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "You've used today's 5 free generations. Come back tomorrow." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } },
    );
  }

  // 3) payload
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const check = checkToolInput(text);
  if (!check.ok) {
    const message =
      check.code === "too_long"
        ? "That's over 15,000 words. Paste a shorter transcript."
        : check.code === "not_enough_sentences"
          ? "Couldn't find enough complete sentences — paste fuller transcript text."
          : "Please paste at least ~80 words of transcript so the result is grounded in the episode.";
    return NextResponse.json({ error: check.code, message }, { status: 400 });
  }

  // 4) daily cost cap → deterministic when exceeded (M12)
  const spend: FreeToolSpendStore = dbSpendStore() ?? instanceSpendStore;
  const cap = await capStatus(spend);
  const run = await runFreeTool(tool, text, {
    aiDisabled: cap.exceeded,
    usage: loggingUsage(spend),
  });

  return NextResponse.json({
    tool,
    mode: run.mode,
    note: run.mode === "deterministic" ? cap.exceeded ? CAP_NOTE : run.note : null,
    result: run.result,
  });
}

/** Structured console line + spend accounting (usage_events cannot hold anonymous rows). */
function loggingUsage(spend: { addCost: (usd: number) => Promise<void> }) {
  return (event: UsageEvent) => {
    consoleUsageLogger(event);
    const cost = event.costUsd || 0;
    if (cost > 0) return spend.addCost(cost);
    return Promise.resolve();
  };
}

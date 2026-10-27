"use client";

// MK-10 free tool page: paste textarea (≤15k words) → POST /api/public/tools/:tool
// → read-only result card with Copy → CTA band. BotID client-side protection
// pairs with the server check (botid/server) on the same route.
import * as React from "react";
import { BotIdClient } from "botid/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "lucide-react";
import type { ToolDef } from "@/lib/tools/defs";

type ToolResponse = {
  tool: string;
  mode: "ai" | "deterministic";
  note: string | null;
  result: Record<string, unknown> & { tool?: string };
  error?: string;
  message?: string;
};

const MAX_WORDS = 15_000;
const MIN_WORDS = 80;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function ToolClient({ def, botIdEnabled }: { def: ToolDef; botIdEnabled: boolean }) {
  const [text, setText] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ToolResponse | null>(null);
  const words = countWords(text);

  async function generate() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/public/tools/${def.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json().catch(() => null)) as ToolResponse | null;
      if (!res.ok || !json || json.error) {
        setStatus("error");
        setErrorMessage(json?.message ?? "Something went wrong on our side. Try again.");
        return;
      }
      setData(json);
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMessage("The generator couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* BotID proof-of-work for the POST this page issues. Off-Vercel
          (local/CI) its worker script 404s and the wrapped fetch rejects, so
          it renders only where the server check actually runs — the server
          bypasses with isDevelopment+bypass in exactly the same condition. */}
      {botIdEnabled ? (
        <BotIdClient protect={[{ path: `/api/public/tools/${def.id}`, method: "POST" }]} />
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="transcript" className="text-sm font-medium">
          {def.textareaLabel}
        </label>
        <textarea
          id="transcript"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={def.textareaPlaceholder}
          className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-faint" aria-live="polite">
            {words.toLocaleString("en-US")} words · up to {MAX_WORDS.toLocaleString("en-US")}
          </span>
          <Button onClick={generate} disabled={status === "loading" || words < MIN_WORDS}>
            {status === "loading" ? "Generating…" : def.generateLabel}
          </Button>
        </div>
        {status === "error" && errorMessage && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
          </p>
        )}
        {words > 0 && words < MIN_WORDS && (
          <p className="text-[13px] text-faint">Paste at least ~80 words so the result is grounded in the episode.</p>
        )}
      </div>

      {data && (
        <div className="flex flex-col gap-4">
          {data.mode === "deterministic" && data.note && (
            <p
              role="status"
              className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              {data.note}
            </p>
          )}
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{def.resultHeading}</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(resultToText(data.result)).then(() => toast("Copied"));
                }}
              >
                <CopyIcon data-icon="inline-start" aria-hidden />
                Copy
              </Button>
            </div>
            <ToolResultView tool={def.id} result={data.result} />
          </div>
        </div>
      )}

      {/* CTA band (MK-10, copy verbatim) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent-border bg-accent-soft p-5">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{def.cta.heading}</span>
          <span className="text-sm text-body">{def.cta.sub}</span>
        </div>
        <a
          href="/sign-up"
          className="inline-flex h-10 items-center justify-center rounded-md border border-accent bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          {def.cta.button}
        </a>
      </div>
    </div>
  );
}

// ---- per-tool read-only rendering --------------------------------------------

function ToolResultView({ tool, result }: { tool: string; result: Record<string, unknown> }) {
  if (tool === "show-notes") {
    return (
      <ResultSection>
        <h3 className="text-base font-semibold">{str(result.title)}</h3>
        <p>{str(result.hook)}</p>
        {Array.isArray(result.bullets) && result.bullets.length > 0 && (
          <>
            <h3 className="text-sm font-semibold">In this episode</h3>
            <ul className="ml-4 list-disc space-y-1">
              {result.bullets.map((b, i) => (
                <li key={i}>{str(b)}</li>
              ))}
            </ul>
          </>
        )}
        {typeof result.quote === "string" && (
          <blockquote className="border-l-[3px] border-accent pl-3">
            <p>“{result.quote}”</p>
            <p className="mt-1 text-xs text-faint">
              — from the episode{" "}
              <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
                ✓ Verified in transcript
              </span>
            </p>
          </blockquote>
        )}
        <p className="text-sm text-body">{str(result.cta)}</p>
      </ResultSection>
    );
  }

  if (tool === "episode-titles") {
    return (
      <ResultSection>
        <h3 className="text-sm font-semibold">Your episode&apos;s themes</h3>
        <div className="flex flex-wrap gap-2">
          {(Array.isArray(result.themes) ? result.themes : []).map((t, i) => (
            <span key={i} className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[13px]">
              {str(t)}
            </span>
          ))}
        </div>
        <h3 className="mt-2 text-sm font-semibold">Title ideas</h3>
        <ol className="ml-4 list-decimal space-y-1">
          {(Array.isArray(result.titles) ? result.titles : []).map((t, i) => {
            const text = typeof t === "string" ? t : str((t as { text?: unknown })?.text);
            const style = typeof t === "object" && t ? str((t as { style?: unknown })?.style) : "";
            return (
              <li key={i}>
                {text}
                {style && (
                  <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                    {style}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </ResultSection>
    );
  }

  if (tool === "email-series") {
    const days = Array.isArray(result.days) ? result.days : [];
    return (
      <ResultSection>
        {days.map((d, i) => {
          const day = d as Record<string, unknown>;
          return (
            <div key={i} className="flex flex-col gap-1.5 border-b border-border pb-3 last:border-b-0">
              <h3 className="text-base font-semibold">{str(day.title)}</h3>
              <p className="text-xs font-medium text-faint">Re-listen</p>
              <blockquote className="border-l-[3px] border-accent pl-3">“{str(day.anchor)}”</blockquote>
              <p className="text-xs font-medium text-faint">Reflection</p>
              <p>{str(day.reflection)}</p>
              <p className="text-xs font-medium text-faint">Do this</p>
              <p>{str(day.action)}</p>
              <p className="text-xs font-medium text-faint">Sign-off</p>
              <p>{str(day.closing)}</p>
            </div>
          );
        })}
        <p className="text-xs text-faint">
          Every quote above is taken word-for-word from the episode you pasted — nothing is invented.
        </p>
      </ResultSection>
    );
  }

  // discussion-guide
  return (
    <ResultSection>
      <h3 className="text-base font-semibold">{str(result.title)}</h3>
      <h4 className="text-sm font-semibold">Opener</h4>
      <p>{str(result.opener)}</p>
      <h4 className="text-sm font-semibold">Warm-up questions</h4>
      <ol className="ml-4 list-decimal space-y-1">
        {(Array.isArray(result.open) ? result.open : []).map((q, i) => (
          <li key={i}>{str(q)}</li>
        ))}
      </ol>
      <h4 className="text-sm font-semibold">From the episode</h4>
      {(Array.isArray(result.qs) ? result.qs : []).map((q, i) => {
        const item = q as Record<string, unknown>;
        return (
          <div key={i} className="flex flex-col gap-1">
            <blockquote className="border-l-[3px] border-accent pl-3">“{str(item.quote)}”</blockquote>
            <p>→ {str(item.follow)}</p>
          </div>
        );
      })}
      <h4 className="text-sm font-semibold">Apply it</h4>
      <ol className="ml-4 list-decimal space-y-1">
        {(Array.isArray(result.apply) ? result.apply : []).map((q, i) => (
          <li key={i}>{str(q)}</li>
        ))}
      </ol>
      <h4 className="text-sm font-semibold">Closing</h4>
      <p>{str(result.closing)}</p>
    </ResultSection>
  );
}

function ResultSection({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 text-[15px] leading-7">{children}</div>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Plain-text serialization for the Copy button. */
function resultToText(result: Record<string, unknown>): string {
  const lines: string[] = [];
  const push = (...xs: unknown[]) => lines.push(xs.map((x) => (typeof x === "string" ? x : "")).join(" "));
  if (typeof result.title === "string") lines.push(result.title, "");
  if (typeof result.hook === "string") push(result.hook, "");
  if (Array.isArray(result.bullets)) {
    lines.push("In this episode");
    for (const b of result.bullets) push(`- ${String(b)}`);
    lines.push("");
  }
  if (typeof result.quote === "string") push(`"${result.quote}"`, "");
  if (Array.isArray(result.themes)) {
    lines.push(`Themes: ${result.themes.map(String).join(", ")}`, "");
  }
  if (Array.isArray(result.titles)) {
    (result.titles as Array<{ text?: string }>).forEach((t, i) => lines.push(`${i + 1}. ${t?.text ?? ""}`));
    lines.push("");
  }
  if (Array.isArray(result.days)) {
    for (const d of result.days as Array<Record<string, unknown>>) {
      push(String(d.title ?? ""), "", `Re-listen: "${String(d.anchor ?? "")}"`, "", String(d.reflection ?? ""), "", `Do this: ${String(d.action ?? "")}`, "", String(d.closing ?? ""), "", "———", "");
    }
  }
  if (typeof result.opener === "string") {
    push("Opener", result.opener, "");
    if (Array.isArray(result.open)) {
      lines.push("Warm-up questions");
      result.open.forEach((q, i) => push(`${i + 1}. ${String(q)}`));
      lines.push("");
    }
    if (Array.isArray(result.qs)) {
      lines.push("From the episode");
      for (const q of result.qs as Array<Record<string, unknown>>) {
        push(`"${String(q.quote ?? "")}"`, `- ${String(q.follow ?? "")}`);
      }
      lines.push("");
    }
    if (Array.isArray(result.apply)) {
      lines.push("Apply it");
      result.apply.forEach((q, i) => push(`${i + 1}. ${String(q)}`));
      lines.push("");
    }
    if (typeof result.closing === "string") push("Closing", result.closing, "");
  }
  lines.push("— generated with EpisodeKit");
  return lines.join("\n").trim();
}

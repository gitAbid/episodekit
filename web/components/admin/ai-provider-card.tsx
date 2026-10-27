"use client";

// MK-11 AI provider card — consumes WP-04's admin API as-is:
//   GET  /api/admin/ai        → selection + provider list (key presence)
//   POST /api/admin/ai/test   → "OK · 1.8 s" / error text
//   PUT  /api/admin/ai        → save selection
// Base URL is preset-derived (the PUT contract has no baseUrl field), so it is
// displayed read-only with a hint for the custom provider's env var.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProviderInfo {
  id: string;
  label: string;
  baseUrl: string | null;
  keyEnv: string;
  keyPresent: boolean;
  defaultLong: string | null;
  defaultFast: string | null;
}

interface GetBody {
  selection?: { provider: string; longModel: string; fastModel: string; fallbackProvider: string };
  source?: string;
  storeAvailable?: boolean;
  providers?: ProviderInfo[];
  error?: string;
}

type TestState = { kind: "ok"; latencyMs: number } | { kind: "error"; text: string } | null;

export function AiProviderCard() {
  const [state, setState] = React.useState<"loading" | "ready" | "denied">("loading");
  const [body, setBody] = React.useState<GetBody | null>(null);
  const [provider, setProvider] = React.useState<string>("");
  const [longModel, setLongModel] = React.useState("");
  const [fastModel, setFastModel] = React.useState("");
  const [test, setTest] = React.useState<TestState>(null);
  const [testing, setTesting] = React.useState(false);
  const [saveState, setSaveState] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/ai")
      .then(async (res) => ({ ok: res.ok, json: (await res.json().catch(() => null)) as GetBody | null }))
      .then(({ ok, json }) => {
        if (!ok || !json?.selection) {
          setState("denied");
          return;
        }
        setBody(json);
        setProvider(json.selection.provider);
        setLongModel(json.selection.longModel);
        setFastModel(json.selection.fastModel);
        setState("ready");
      })
      .catch(() => setState("denied"));
  }, []);

  const providers = body?.providers ?? [];
  const current = providers.find((p) => p.id === provider);

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/admin/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; latencyMs?: number; error?: { message?: string }; text?: string }
        | null;
      if (json?.ok) setTest({ kind: "ok", latencyMs: json.latencyMs ?? 0 });
      else
        setTest({
          kind: "error",
          text: json?.error?.message ?? json?.text ?? "Test failed — check the provider key and model.",
        });
    } catch {
      setTest({ kind: "error", text: "Test request failed." });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveState(null);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, longModel, fastModel, fallbackProvider: body?.selection?.fallbackProvider ?? "groq" }),
      });
      setSaveState(res.ok ? "Saved" : `Save failed (${res.status})`);
    } catch {
      setSaveState("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") {
    return (
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-xl font-semibold">AI provider</h2>
        <p className="mt-2 text-sm text-faint">Loading…</p>
      </section>
    );
  }

  if (state === "denied") {
    return (
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-xl font-semibold">AI provider</h2>
        <p className="mt-2 text-sm text-body">
          Owner-only. This card unlocks when Clerk is configured and your email is in
          OWNER_EMAILS.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <h2 className="text-xl font-semibold">AI provider</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="provider" className="text-sm font-medium">
            Primary provider
          </label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger id="provider" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[13px] text-faint">
            Key {current?.keyEnv ?? "—"} ·{" "}
            {current?.keyPresent ? (
              <span className="text-success">present ✓</span>
            ) : (
              <span className="text-danger">missing ✗</span>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="baseurl" className="text-sm font-medium">
            Base URL
          </label>
          <Input id="baseurl" readOnly value={current?.baseUrl ?? ""} className="font-mono" />
          <span className="text-[13px] text-faint">
            From the provider preset{provider === "custom" ? " (set AI_CUSTOM_BASE_URL)" : ""}.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="longmodel" className="text-sm font-medium">
            Long-form model
          </label>
          <Input
            id="longmodel"
            value={longModel}
            onChange={(e) => setLongModel(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fastmodel" className="text-sm font-medium">
            Fast model
          </label>
          <Input
            id="fastmodel"
            value={fastModel}
            onChange={(e) => setFastModel(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={runTest} disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {test?.kind === "ok" && (
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
            OK · {(test.latencyMs / 1000).toFixed(1)} s
          </span>
        )}
        {test?.kind === "error" && (
          <span className="text-sm text-danger" role="alert">
            {test.text}
          </span>
        )}
        <span className="grow" />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saveState && <span className="text-sm text-body">{saveState}</span>}
      </div>
      <p className="text-[13px] text-faint">
        Keys are set in Vercel environment variables. This page never shows them.
        {body?.storeAvailable === false && " Saving is unavailable without the database."}
      </p>
    </section>
  );
}

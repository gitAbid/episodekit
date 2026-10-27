// §7.1 usage_events logging interface. The DB-backed logger lands with the
// WP-02 schema; until then every call is logged in a structured line so cost
// visibility never silently disappears. Loggers must never throw into the
// generation path (generate.ts guards anyway).
export type UsageKind = "asr" | "llm" | "free_tool";

export interface UsageEvent {
  workspaceId: string | null;
  episodeId: string | null;
  kind: UsageKind;
  provider: string;
  model: string;
  /** for llm: total tokens (prompt + completion); for asr: audio seconds */
  units: number;
  costUsd: number;
}

export type UsageLogger = (event: UsageEvent) => Promise<void> | void;

export const consoleUsageLogger: UsageLogger = (event) => {
  console.log(JSON.stringify({ usage_event: event }));
};

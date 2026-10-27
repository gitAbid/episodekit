// §8.2-adjacent prompts for the free tools. Rules mirror the shared system
// prompt's honesty clauses: transcript facts only, nothing invented, no URLs.
// Weak-model hardening: low temperature, flat schema, shape example inline.
import type { ToolId } from "./defs";
export const TOOL_TEMPERATURE = 0.4;

const SYSTEM = [
  "You write podcast content from an episode transcript.",
  "Use only facts from the transcript. Never invent names, numbers, links or claims.",
  "Never quote a sentence that is not in the transcript word-for-word.",
  "Never include URLs. Plain, concrete language. Return only JSON matching the schema below.",
].join(" ");

export interface ToolPrompt {
  system: string;
  user: string;
  temperature: number;
  /** zod schema for the model's JSON */
  schemaName: "ShowNotesAi" | "TitlesAi" | "EmailSeriesAi" | "DiscussionAi";
}

export function buildToolPrompt(tool: ToolId, transcript: string): ToolPrompt {
  const clipped = transcript.length > 60_000 ? transcript.slice(0, 60_000) : transcript;
  switch (tool) {
    case "show-notes":
      return {
        system: SYSTEM,
        temperature: TOOL_TEMPERATURE,
        schemaName: "ShowNotesAi",
        user: [
          "Write show notes for this episode.",
          "JSON schema: {\"title\": string (<=120 chars, specific to THIS episode), \"hook\": string (2-3 sentences, the payoff first), \"bullets\": [4 to 7 strings — claims the episode actually makes, one line each], \"cta\": string (<=200 chars, invite listeners to follow the show)}",
          "TRANSCRIPT:",
          clipped,
        ].join("\n"),
      };
    case "episode-titles":
      return {
        system: SYSTEM,
        temperature: TOOL_TEMPERATURE,
        schemaName: "TitlesAi",
        user: [
          "Generate episode title ideas plus the episode's themes.",
          "JSON schema: {\"themes\": [3 to 8 single words the episode is actually about, lowercase], \"titles\": [{\"text\": string (<=80 chars, a promise not a topic), \"style\": one of \"Curiosity\"|\"Benefit\"|\"Guest\"|\"Number\"|\"Question\"|\"Quote\"}]} — give 8 titles.",
          "TRANSCRIPT:",
          clipped,
        ].join("\n"),
      };
    case "email-series":
      return {
        system: SYSTEM,
        temperature: TOOL_TEMPERATURE,
        schemaName: "EmailSeriesAi",
        user: [
          "Write a 5-day email series from this episode.",
          "JSON schema: {\"days\": exactly 5 of {\"title\": string (<=80), \"anchor\": string (copy ONE sentence from the transcript character-for-character — it will be verified), \"reflection\": string (2-4 sentences expanding that sentence), \"action\": string (one concrete step for the reader), \"closing\": string (one short sign-off line)}}",
          "TRANSCRIPT:",
          clipped,
        ].join("\n"),
      };
    case "discussion-guide":
      return {
        system: SYSTEM,
        temperature: TOOL_TEMPERATURE,
        schemaName: "DiscussionAi",
        user: [
          "Write a community discussion kit for this episode.",
          "JSON schema: {\"title\": string (<=120), \"opener\": string (one question), \"open\": [2 to 4 warm-up question strings], \"qs\": [4 to 6 of {\"quote\": string (copy ONE sentence from the transcript character-for-character — it will be verified), \"follow\": string (the discussion question about that quote)}], \"apply\": exactly 2 action-prompt strings, \"closing\": string (how to end the discussion)}",
          "TRANSCRIPT:",
          clipped,
        ].join("\n"),
      };
  }
}

// Free-tool output shapes.
//
// Integrity rule (§0.5: quotes are reconstructed from the transcript, never
// from model text): the model NEVER authors quote text. Fields marked VERBATIM
// below are attached server-side from the transcript (lib/engine) in BOTH
// modes; the model may only claim anchors, and every claim is checked with
// lib/quotes/normalize.isExactQuote — a non-verbatim claim is replaced by the
// deterministic pick. The AI path writes the connective prose only.
import { z } from "zod";

// ---- AI creative responses (what the LLM must return) ------------------------

export const TitleStyleSchema = z.enum(["Curiosity", "Benefit", "Guest", "Number", "Question", "Quote"]);
export type TitleStyle = z.output<typeof TitleStyleSchema>;

export const ShowNotesAiSchema = z.object({
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(600),
  bullets: z.array(z.string().min(1).max(200)).min(4).max(7),
  cta: z.string().min(1).max(200).optional(),
});
export type ShowNotesAi = z.output<typeof ShowNotesAiSchema>;

export const TitlesAiSchema = z.object({
  themes: z.array(z.string().min(1).max(40)).min(3).max(8),
  titles: z
    .array(z.object({ text: z.string().min(1).max(80), style: TitleStyleSchema }))
    .min(4)
    .max(8),
});
export type TitlesAi = z.output<typeof TitlesAiSchema>;

export const EmailSeriesAiSchema = z.object({
  days: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        /** VERBATIM claim — replaced when it is not an exact transcript quote. */
        anchor: z.string().min(1).max(600),
        reflection: z.string().min(1).max(900),
        action: z.string().min(1).max(300),
        closing: z.string().min(1).max(200),
      }),
    )
    .length(5),
});
export type EmailSeriesAi = z.output<typeof EmailSeriesAiSchema>;

export const DiscussionAiSchema = z.object({
  title: z.string().min(1).max(120),
  opener: z.string().min(1).max(300),
  open: z.array(z.string().min(1).max(200)).min(2).max(4),
  /** quote entries are VERBATIM claims — non-exact ones are replaced. */
  qs: z
    .array(z.object({ quote: z.string().min(1).max(420), follow: z.string().min(1).max(200) }))
    .min(4)
    .max(6),
  apply: z.array(z.string().min(1).max(200)).length(2),
  closing: z.string().min(1).max(300),
});
export type DiscussionAi = z.output<typeof DiscussionAiSchema>;

// ---- final rendered results (both modes) -------------------------------------

export interface ShowNotesResult {
  title: string;
  hook: string;
  bullets: string[];
  /** Exact transcript sentence, server-picked. */
  quote: string | null;
  cta: string;
}

export interface TitlesResult {
  themes: string[];
  titles: Array<{ text: string; style: TitleStyle }>;
}

export interface EmailSeriesResult {
  days: Array<{ day: number; title: string; anchor: string; reflection: string; action: string; closing: string }>;
}

export interface DiscussionResult {
  title: string;
  opener: string;
  open: string[];
  qs: Array<{ quote: string; follow: string }>;
  apply: string[];
  closing: string;
}

export type ToolResult =
  | ({ tool: "show-notes" } & ShowNotesResult)
  | ({ tool: "episode-titles" } & TitlesResult)
  | ({ tool: "email-series" } & EmailSeriesResult)
  | ({ tool: "discussion-guide" } & DiscussionResult);

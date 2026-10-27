// MK-10 — the four free tools at their legacy paths (M12): /tools/show-notes,
// /tools/episode-titles, /tools/email-series, /tools/discussion-guide.
// Static shell + one small client island for paste/generate.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOL_DEFS, TOOL_IDS, type ToolId } from "@/lib/tools/defs";
import { ToolClient } from "@/components/marketing/tool-client";

export function generateStaticParams(): Array<{ tool: ToolId }> {
  return TOOL_IDS.map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  if (!isTool(tool)) return {};
  const def = TOOL_DEFS[tool];
  return { title: def.title, description: def.metaDescription };
}

function isTool(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

/** SEO tip line under the tool (ported from the legacy pages). */
const TIPS: Record<ToolId, string> = {
  "show-notes":
    "Tip: paste the full transcript — more text means better section headings. Prefer a blank structure to fill yourself? Grab the free show notes template →",
  "episode-titles": "Tip: paste the full transcript — more text means sharper themes and better titles.",
  "email-series":
    "Every quote in the series is taken word-for-word from the episode you pasted — nothing is invented.",
  "discussion-guide":
    "Every quote in the kit is taken word-for-word from what you pasted — nothing is invented.",
};

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isTool(tool)) notFound();
  const def = TOOL_DEFS[tool];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-faint">FREE TOOL · NO SIGNUP</span>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight">{def.h1}</h1>
        <p className="text-body">{def.intro}</p>
      </div>

      <ToolClient def={def} botIdEnabled={Boolean(process.env.VERCEL)} />

      <p className="text-sm text-body">
        {TIPS[tool]}{" "}
        {tool === "show-notes" ? (
          <Link href="/templates/show-notes" className="text-accent hover:underline">
            Show notes template
          </Link>
        ) : (
          <Link href="/tools" className="text-accent hover:underline">
            All free tools
          </Link>
        )}
      </p>
    </div>
  );
}

"use client";
// MK-6b artifact layouts: every field an auto-growing textarea (Markdown
// allowed where §7.2 says so), autosave 1.5 s after the last keystroke,
// char/word counters with limits. One component per kind so hooks stay
// unconditional; the parent remounts editors on regenerate via `key`.
import { useEffect, useRef, useState } from "react";
import type { ArtifactKindName, ArtifactView, TranscriptSegment } from "@/lib/pipeline/client";
import { renderBlogBody } from "@/lib/export/format";

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function EditorShell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** Auto-growing textarea with the 1.5 s debounced autosave (M6). */
function AutoField({
  value,
  onChange,
  onSave,
  label,
  max,
  words,
  rows = 3,
  markdown,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  label: string;
  max?: number;
  words?: [number, number];
  rows?: number;
  markdown?: boolean;
  testId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  const handle = (v: string) => {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onSave, 1500);
  };

  const count = words
    ? `${value.trim().split(/\s+/).filter(Boolean).length} words (${words[0]}–${words[1]})`
    : `${value.length}${max ? `/${max}` : ""}`;
  const over = max !== undefined && value.length > max;
  const warn = max !== undefined && !over && value.length >= max * 0.9;

  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>}
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        data-testid={testId}
        onChange={(e) => handle(e.target.value)}
        className={`w-full resize-none rounded-md border px-3 py-2 text-sm ${markdown ? "font-mono" : ""}`}
      />
      <span
        className={`mt-0.5 block text-right text-xs ${over ? "text-[var(--danger)]" : warn ? "text-[var(--warning)]" : "text-muted-foreground"}`}
        data-testid="field-counter"
      >
        {count}
      </span>
    </label>
  );
}

interface EditorProps {
  content: Record<string, unknown>;
  patch: (p: Record<string, unknown>) => void;
  save: () => void;
  segments: TranscriptSegment[];
  chapters: { startMs: number; title: string }[];
}

const str = (content: Record<string, unknown>, key: string): string =>
  typeof content[key] === "string" ? (content[key] as string) : "";

function ShowNotesEditor({ content, patch, save, chapters }: EditorProps) {
  const bullets = Array.isArray(content.bullets) ? (content.bullets as string[]) : [];
  return (
    <EditorShell>
      <AutoField label="Hook" value={str(content, "hook")} onChange={(v) => patch({ hook: v })} onSave={save} rows={3} testId="edit-hook" />
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">In this episode (4–7)</p>
        {bullets.map((b, i) => (
          <div key={i} className="mb-1 flex items-center gap-2">
            <span aria-hidden>•</span>
            <input
              value={b}
              onChange={(e) => patch({ bullets: bullets.map((x, j) => (j === i ? e.target.value : x)) })}
              onBlur={save}
              className="flex-1 rounded-md border px-3 py-1.5 text-sm"
              data-testid={`edit-bullet-${i}`}
            />
            <button type="button" aria-label={`Remove bullet ${i + 1}`} onClick={() => { patch({ bullets: bullets.filter((_, j) => j !== i) }); setTimeout(save, 0); }}>
              ✕
            </button>
          </div>
        ))}
        {bullets.length < 7 && (
          <button type="button" onClick={() => patch({ bullets: [...bullets, ""] })} className="rounded-md border px-3 py-1 text-sm" data-testid="add-bullet">
            + bullet
          </button>
        )}
      </div>
      {chapters.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Chapters (from the Chapters tab)</p>
          {chapters.map((c) => (
            <p key={c.startMs} className="font-mono text-sm">
              {mmss(c.startMs)} {c.title}
            </p>
          ))}
        </div>
      )}
      {str(content, "guestLine") !== "" && (
        <AutoField label="Guest line" value={str(content, "guestLine")} onChange={(v) => patch({ guestLine: v })} onSave={save} rows={2} />
      )}
      <AutoField label="Call to action" value={str(content, "cta")} onChange={(v) => patch({ cta: v })} onSave={save} rows={2} />
    </EditorShell>
  );
}

function ChaptersEditor({ content, patch, save }: EditorProps) {
  const items = Array.isArray(content.items) ? (content.items as { startMs: number; title: string }[]) : [];
  return (
    <EditorShell>
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="font-mono text-sm">{mmss(c.startMs)}</span>
          <input
            value={c.title}
            maxLength={50}
            onChange={(e) => patch({ items: items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
            onBlur={save}
            className="flex-1 rounded-md border px-3 py-1.5 text-sm"
          />
          <button type="button" aria-label={`Remove chapter ${i + 1}`} onClick={() => { patch({ items: items.filter((_, j) => j !== i) }); setTimeout(save, 0); }}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const last = items[items.length - 1];
          patch({ items: [...items, { startMs: last ? last.startMs + 120_000 : 0, title: "" }] });
          setTimeout(save, 0);
        }}
        className="rounded-md border px-3 py-1.5 text-sm"
        data-testid="add-chapter"
      >
        Add chapter
      </button>
    </EditorShell>
  );
}

function SummaryEditor({ content, patch, save }: EditorProps) {
  return (
    <EditorShell>
      <AutoField label="One-liner" value={str(content, "oneLiner")} onChange={(v) => patch({ oneLiner: v })} onSave={save} max={140} rows={2} testId="edit-one-liner" />
      <AutoField label="Short (50–80 words)" value={str(content, "short")} onChange={(v) => patch({ short: v })} onSave={save} words={[50, 80]} rows={4} />
      <AutoField label="Long (150–220 words)" value={str(content, "long")} onChange={(v) => patch({ long: v })} onSave={save} words={[150, 220]} rows={8} />
    </EditorShell>
  );
}

function TitlesEditor({ content, patch, save }: EditorProps) {
  const items = Array.isArray(content.items) ? (content.items as { text: string; style: string; starred: boolean }[]) : [];
  const [chosen, setChosen] = useState(-1);
  return (
    <EditorShell>
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border p-2">
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">{t.style}</span>
          <input
            value={t.text}
            maxLength={80}
            onChange={(e) => patch({ items: items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            onBlur={save}
            className="flex-1 bg-transparent text-sm"
          />
          <button
            type="button"
            aria-label={t.starred ? `Unstar title ${i + 1}` : `Star title ${i + 1}`}
            onClick={() => { patch({ items: items.map((x, j) => (j === i ? { ...x, starred: !x.starred } : x)) }); setTimeout(save, 0); }}
          >
            {t.starred ? "★" : "☆"}
          </button>
          <button type="button" onClick={() => void navigator.clipboard.writeText(t.text)} aria-label={`Copy title ${i + 1}`}>
            ⧉
          </button>
          <button
            type="button"
            onClick={() => setChosen(i)}
            className={`rounded border px-2 py-0.5 text-xs ${chosen === i ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}
            data-testid={`use-as-title-${i}`}
          >
            Use as title
          </button>
        </div>
      ))}
    </EditorShell>
  );
}

function BlogEditor({ content, patch, save, segments }: EditorProps) {
  const [preview, setPreview] = useState(false);
  const quoteRefs = Array.isArray(content.quoteRefs) ? (content.quoteRefs as unknown[]) : [];
  return (
    <EditorShell>
      <div className="rounded-md border p-3">
        <AutoField label="SEO title (≤60)" value={str(content, "seoTitle")} onChange={(v) => patch({ seoTitle: v })} onSave={save} max={60} rows={1} />
        <AutoField label="Meta description (≤155)" value={str(content, "metaDescription")} onChange={(v) => patch({ metaDescription: v })} onSave={save} max={155} rows={2} />
        <AutoField label="Slug" value={str(content, "slug")} onChange={(v) => patch({ slug: v })} onSave={save} rows={1} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Body (Markdown)</span>
        <button type="button" onClick={() => setPreview((p) => !p)} className="rounded border px-2 py-0.5 text-xs" data-testid="blog-preview-toggle">
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <pre className="whitespace-pre-wrap rounded-md border p-3 text-sm" data-testid="blog-preview">
          {renderBlogBody(str(content, "bodyMarkdown"), quoteRefs, { segments, showName: "", episodeTitle: "", freePlan: false })}
        </pre>
      ) : (
        <AutoField label="" value={str(content, "bodyMarkdown")} onChange={(v) => patch({ bodyMarkdown: v })} onSave={save} rows={16} markdown testId="edit-blog-body" />
      )}
    </EditorShell>
  );
}

function NewsletterEditor({ content, patch, save }: EditorProps) {
  const subjects = Array.isArray(content.subjects) ? (content.subjects as string[]) : [];
  const [customSubject, setCustomSubject] = useState("");
  const [picked, setPicked] = useState(0);
  return (
    <EditorShell>
      {subjects.map((s, i) => (
        <label key={i} className="flex items-center gap-2 text-sm">
          <input type="radio" name="subject" checked={picked === i} onChange={() => setPicked(i)} />
          <input value={s} onChange={(e) => patch({ subjects: subjects.map((x, j) => (j === i ? e.target.value : x)) })} onBlur={save} className="flex-1 rounded-md border px-2 py-1" />
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="subject" checked={picked === subjects.length} onChange={() => setPicked(subjects.length)} />
        <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Custom subject" className="flex-1 rounded-md border px-2 py-1" />
      </label>
      <AutoField label="Preview text (≤90)" value={str(content, "previewText")} onChange={(v) => patch({ previewText: v })} onSave={save} max={90} rows={2} />
      <AutoField label="Body (Markdown)" value={str(content, "bodyMarkdown")} onChange={(v) => patch({ bodyMarkdown: v })} onSave={save} rows={10} markdown testId="edit-newsletter-body" />
      <AutoField label="CTA (≤30)" value={str(content, "ctaText")} onChange={(v) => patch({ ctaText: v })} onSave={save} max={30} rows={1} />
    </EditorShell>
  );
}

function SocialEditor({ content, patch, save }: EditorProps) {
  const thread = Array.isArray(content.thread) ? (content.thread as string[]) : [];
  const ig = (content.instagram ?? {}) as { caption?: string; hashtags?: string[] };
  const [tab, setTab] = useState<"linkedin" | "thread" | "instagram">("linkedin");
  return (
    <EditorShell>
      <div role="tablist" className="flex gap-4 border-b text-sm">
        {(["linkedin", "thread", "instagram"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 py-1 capitalize ${tab === t ? "border-[var(--accent)] font-medium" : "border-transparent"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "linkedin" && (
        <AutoField label="LinkedIn post (≤1300)" value={str(content, "linkedin")} onChange={(v) => patch({ linkedin: v })} onSave={save} max={1300} rows={10} testId="edit-linkedin" />
      )}
      {tab === "thread" &&
        thread.map((p, i) => (
          <div key={i} className="rounded-md border p-2">
            <p className="mb-1 text-xs text-muted-foreground">Post {i + 1}</p>
            <AutoField label="" value={p} onChange={(v) => patch({ thread: thread.map((x, j) => (j === i ? v : x)) })} onSave={save} max={280} rows={3} testId={`edit-thread-${i}`} />
          </div>
        ))}
      {tab === "instagram" && (
        <>
          <AutoField label="Caption (≤2200)" value={ig.caption ?? ""} onChange={(v) => patch({ instagram: { ...ig, caption: v } })} onSave={save} max={2200} rows={8} />
          <AutoField
            label="Hashtags (5–10)"
            value={(ig.hashtags ?? []).join(" ")}
            onChange={(v) => patch({ instagram: { ...ig, hashtags: v.split(/\s+/).filter(Boolean) } })}
            onSave={save}
            rows={2}
          />
        </>
      )}
    </EditorShell>
  );
}

export function ArtifactEditor(props: {
  kind: ArtifactKindName;
  artifact: ArtifactView;
  segments: TranscriptSegment[];
  chapters: { startMs: number; title: string }[];
  onSave: (content: Record<string, unknown>) => Promise<void> | void;
}) {
  const [content, setContent] = useState<Record<string, unknown>>(props.artifact.content ?? {});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // The 1.5 s debounce outlives renders; a ref keeps the timer's save reading
  // the latest content instead of the closure captured at keystroke time.
  const contentRef = useRef(content);
  contentRef.current = content;

  const patch = (p: Record<string, unknown>) => setContent((c) => ({ ...c, ...p }));
  const save = async () => {
    await props.onSave(contentRef.current);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const editorProps: EditorProps = { content, patch, save, segments: props.segments, chapters: props.chapters };
  switch (props.kind) {
    case "show_notes":
      return <WithHint savedAt={savedAt}><ShowNotesEditor {...editorProps} /></WithHint>;
    case "chapters":
      return <WithHint savedAt={savedAt}><ChaptersEditor {...editorProps} /></WithHint>;
    case "summary":
      return <WithHint savedAt={savedAt}><SummaryEditor {...editorProps} /></WithHint>;
    case "titles":
      return <WithHint savedAt={savedAt}><TitlesEditor {...editorProps} /></WithHint>;
    case "blog":
      return <WithHint savedAt={savedAt}><BlogEditor {...editorProps} /></WithHint>;
    case "newsletter":
      return <WithHint savedAt={savedAt}><NewsletterEditor {...editorProps} /></WithHint>;
    case "social":
      return <WithHint savedAt={savedAt}><SocialEditor {...editorProps} /></WithHint>;
    default:
      return null;
  }
}

function WithHint({ savedAt, children }: { savedAt: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {children}
      <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="autosave-hint">
        {savedAt ? `Saved · ${savedAt}` : "Changes save automatically."}
      </p>
    </div>
  );
}

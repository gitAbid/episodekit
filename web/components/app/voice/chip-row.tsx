"use client";

// MK-2/MK-8 chip + segmented primitives (mock.css .chip/.seg, §5.2 tokens).
import { useState, type KeyboardEvent } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Removable chip list with an inline "+ Add" flow (tone, Never say, …). */
export function ChipList({
  label,
  items,
  testIdPrefix,
  onRemove,
  onAdd,
  max,
  maxedCopy,
}: {
  label: string;
  items: string[];
  testIdPrefix: string;
  onRemove: (item: string) => void;
  onAdd: (item: string) => void;
  max: number;
  maxedCopy?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const full = items.length >= max;

  function commit() {
    const value = draft.trim();
    setDraft("");
    setAdding(false);
    if (!value) return;
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) return;
    onAdd(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setDraft("");
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-2" data-testid={`${testIdPrefix}-chips`}>
        {items.map((item) => (
          <span
            key={item}
            data-testid={`${testIdPrefix}-chip-${slug(item)}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-4xl border border-border-strong bg-surface px-2.5 text-small"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              data-testid={`${testIdPrefix}-remove-${slug(item)}`}
              onClick={() => onRemove(item)}
              className="text-faint transition-colors hover:text-danger"
            >
              <XIcon className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        {adding && !full ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            aria-label={`New ${label.toLowerCase()} term`}
            className="h-7 w-36 py-0 text-small"
            maxLength={60}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid={`${testIdPrefix}-add`}
            disabled={full}
            title={full ? maxedCopy : undefined}
            onClick={() => setAdding(true)}
          >
            <PlusIcon data-icon="inline-start" aria-hidden /> Add
          </Button>
        )}
      </div>
    </div>
  );
}

/** §MK-2/MK-8 segmented control (Emoji, Write as, Sentence length). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  testIdPrefix,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  testIdPrefix: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-small font-medium">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex overflow-hidden rounded-md border border-border-strong"
        data-testid={testIdPrefix}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            data-testid={`${testIdPrefix}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-small transition-colors ${
              value === option.value ? "bg-accent-soft font-medium text-accent" : "text-body hover:bg-surface-2"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Stable DOM/testid slug for a chip value. */
export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "term";
}

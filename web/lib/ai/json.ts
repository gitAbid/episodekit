// JSON extraction for model output: LLMs wrap JSON in prose or ``` fences even
// in json_object mode. Tolerant parse; strict validation happens in Zod after.
export function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** The single §8.1 "repair" follow-up prompt. */
export function repairPrompt(originalUser: string, schemaHint: string, problem: string): string {
  return (
    `${originalUser}\n\n` +
    `Your previous reply was not usable (${problem}). Return valid JSON for this schema:\n` +
    `${schemaHint}\nReturn ONLY the JSON object, no prose, no code fences.`
  );
}

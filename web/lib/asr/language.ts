/**
 * Language gate (§8.3): English episodes only for the MVP.
 *
 * Two checks, both ported from the legacy app:
 * - the Whisper `language` field (full name, e.g. "english") must be English;
 * - the Latin ratio check `supportedInput()` ported verbatim from
 *   api/generate-suite.js — non-Latin transcripts (CJK/Cyrillic/Arabic…)
 *   would yield empty artifacts downstream.
 *
 * Failing either marks the episode failed with error_code
 * unsupported_language and no quota is used (U19).
 */

/** Latin ratio ≥ 0.6 required — ported verbatim from api/generate-suite.js. */
export function supportedInput(text: string): boolean {
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  return letters === 0 ? false : latin / letters >= 0.6;
}

const ENGLISH_ASR_LANGUAGES = new Set(["en", "english"]);

export function isSupportedAsrLanguage(
  whisperLanguage: string | undefined | null,
  text: string,
): boolean {
  if (whisperLanguage && !ENGLISH_ASR_LANGUAGES.has(whisperLanguage.trim().toLowerCase())) {
    return false;
  }
  return supportedInput(text);
}

/**
 * API copy. User-visible strings come from the §6 copy deck (02-design.md) or
 * are plain second person, <= 12 words (01-product.md §0.4 rule 4).
 */

/** U2 acceptance copy — verbatim. */
export const RSS_ERROR_COPY = "We couldn't read that feed. Check the URL or skip.";

export const SAVE_UNAVAILABLE_COPY = "Saving is unavailable in this preview.";

export const AUTH_REQUIRED_COPY = "Sign in to continue.";

export const NO_SHOW_COPY = "Create your show first.";

export const SHOW_NAME_REQUIRED_COPY = "Enter your show name.";

export const URL_INVALID_COPY = "Enter a valid URL.";

// --- WP-05: intake + ASR (§6 copy deck unless noted) ---

/** U19 — verbatim. */
export const UNSUPPORTED_LANGUAGE_COPY =
  "EpisodeKit works with English episodes for now. This one wasn't charged.";

export function tooLongCopy(limit: string): string {
  return `Episodes can be up to ${limit} on your plan.`;
}

export const NO_SPEECH_COPY =
  "We couldn't hear any speech in this file. Check the audio and try again.";

/** transcribe_failed / generic — verbatim. */
export const TRANSCRIBE_FAILED_COPY =
  "Something went wrong on our side. Try again — it won't use another episode.";

export const NO_AUDIO_COPY = "This episode has no audio to transcribe.";

export const UPLOAD_AUDIO_FIRST_COPY = "Upload the audio before transcribing.";

/** Keyless preview (no BLOB_READ_WRITE_TOKEN) — audio upload answers 503. */
export const AUDIO_UPLOAD_UNAVAILABLE_COPY = "Audio upload isn't set up in this preview.";

export const AUDIO_PLAYBACK_UNAVAILABLE_COPY = "Audio playback isn't set up in this preview.";

export const PASTE_TRANSCRIPT_FIRST_COPY = "Paste a transcript first.";

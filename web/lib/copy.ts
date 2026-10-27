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

// WP-07 — voice onboarding + settings (§7.4, MK-2, MK-8). Where the §6 deck is
// silent these are plain second person, ≤ 12 words (01-product.md §0.4 rule 4).
export const SAMPLE_TOO_SHORT_COPY = "Each example needs at least 150 words.";

export const SAMPLE_LIMIT_COPY = "Up to three examples.";

export const VOICE_PROFILE_INVALID_COPY = "That voice profile isn't valid.";

/** Deterministic no-AI results are labelled, never passed off as AI (U3/U10). */
export const VOICE_BASIC_PROFILE_COPY = "Basic profile — our AI writer was unavailable.";

export const VOICE_BASIC_PREVIEW_COPY = "Basic version — our AI writer was unavailable.";

/** §7.4 fixes tone at exactly 3 words; Save/Continue waits for a replacement. */
export const VOICE_TONE_HINT_COPY = "Add a tone word.";

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

/** WP-08 billing route copy — plain, second person, <= 12 words (§0.4 rule 4). */

export const CHECKOUT_UNAVAILABLE_COPY = "Checkout isn't set up in this preview.";

export const ALREADY_PRO_COPY = "You're already on Pro.";

export const FREE_PLAN_CANCEL_COPY = "You're on the Free plan.";

export const LS_UNREACHABLE_COPY = "Couldn't reach the payment provider. Try again.";

export const OWNER_ONLY_COPY = "Only the owner can change plans.";

export const OWNER_NOT_CONFIGURED_COPY = "Owner access isn't configured.";

export const NO_WORKSPACE_FOR_EMAIL_COPY = "No workspace found for that email.";

export const PLAN_REQUIRED_COPY = "Choose a plan to upgrade to.";

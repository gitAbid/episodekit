// SermonKit transcription endpoint — POST raw audio bytes (Content-Type: audio/*,
// X-Filename header optional). Returns { transcript } or a coded error:
// 503 not_configured (client falls back to transcript-paste), 413 too_large,
// 422 empty_transcript, 502 provider failure.

import { readBody, transcribe, AsrError } from "./asr.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "same-origin");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  try {
    const audio = await readBody(req);
    const transcript = await transcribe(audio, {
      mimetype: req.headers["content-type"],
      filename: req.headers["x-filename"],
    });
    return res.status(200).json({ transcript, words: transcript.split(/\s+/).length });
  } catch (err) {
    if (err instanceof AsrError) {
      return res.status(err.status).json({ error: err.code });
    }
    console.error("transcribe_failed", err?.message);
    return res.status(500).json({ error: "internal" });
  }
}

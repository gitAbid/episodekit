/**
 * Upload allow-list decisions shared by the browser intake (MK-4) and the
 * /api/uploads/token route (§7.5). Extensions from M2; size ≤300 MB
 * compressed (§7.5).
 */
import { AUDIO_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/episodes/input";

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isAllowedAudioFilename(name: string): boolean {
  return (AUDIO_UPLOAD_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export type UploadCheck = { ok: true } | { ok: false; reason: "type" | "size"; copy: string };

export function checkUpload(filename: string, sizeBytes: number): UploadCheck {
  if (!isAllowedAudioFilename(filename)) {
    return { ok: false, reason: "type", copy: "That file type isn't supported. Try MP3, M4A, WAV, MP4 or MOV." };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "size", copy: "That file is over the 300 MB upload limit." };
  }
  return { ok: true };
}

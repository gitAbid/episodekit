/**
 * Blob boundary (§9: private Blob via signed URLs). Every @vercel/blob call
 * goes through this module so tests can mock the seam and the app degrades
 * cleanly when BLOB_READ_WRITE_TOKEN is missing (owner blocker — tracked in
 * the WP-05 PR; uploads/audio answer 503 until it is configured).
 */
import {
  head,
  issueSignedToken,
  presignUrl,
  type HeadBlobResult,
} from "@vercel/blob";
import { handleUpload as blobHandleUpload } from "@vercel/blob/client";

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface ClientUploadConstraints {
  allowedContentTypes: readonly string[];
  maximumSizeInBytes: number;
}

/**
 * Server half of the @vercel/blob client-upload flow: verifies the request,
 * issues a short-lived client token scoped to the constraints, and accepts
 * upload-completed callbacks. Returns the JSON to write back.
 */
export async function handleClientUpload(
  request: Request,
  constraints: ClientUploadConstraints,
): Promise<unknown> {
  const body = await request.json().catch(() => null);
  const result = await blobHandleUpload({
    request,
    body: body as never,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: [...constraints.allowedContentTypes],
      maximumSizeInBytes: constraints.maximumSizeInBytes,
      validUntil: Date.now() + 60 * 60 * 1000,
    }),
  });
  return result;
}

export async function headBlob(pathname: string): Promise<HeadBlobResult> {
  return head(pathname);
}

/** Signed short-lived GET URL (10 min) for private-blob playback (M5/M7). */
export async function issueAudioUrl(
  pathname: string,
  ttlMs = 10 * 60 * 1000,
): Promise<{ url: string; expiresAt: string }> {
  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });
  return { url: presignedUrl, expiresAt: new Date(validUntil).toISOString() };
}

/** Downloads a chunk for server-side ASR (§8.3). */
export async function fetchChunkAudio(pathname: string): Promise<{
  body: ArrayBuffer;
  contentType: string;
  filename: string;
}> {
  const meta = await head(pathname);
  const res = await fetch(meta.downloadUrl);
  if (!res.ok) throw new Error(`blob_fetch_${res.status}`);
  return {
    body: await res.arrayBuffer(),
    contentType: meta.contentType,
    filename: meta.pathname.split("/").pop() ?? "chunk",
  };
}

/**
 * Static intake shell (WP-02). Real upload/compression/transcript parsing
 * ships in WP-05/06 (M2, MK-4). Copy is from the mockup/spec.
 */
export function EpisodeIntakeShell() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 border-b text-sm">
        <span className="border-b-2 border-blue-700 pb-2 font-medium">Upload audio</span>
        <span className="pb-2 text-neutral-500">Paste transcript</span>
      </div>
      <div
        className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-400 p-6 text-center"
        data-testid="drop-zone"
      >
        <span className="text-sm font-medium">Drop audio or video, or browse</span>
        <span className="text-xs text-neutral-500">
          MP3, M4A, WAV, AAC, OGG, MP4, MOV · up to 2 hours
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-500"
        >
          Create package
        </button>
        <span className="text-xs text-neutral-500">Episode intake is coming soon.</span>
      </div>
    </div>
  );
}

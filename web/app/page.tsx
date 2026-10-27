// WP-00 scaffold placeholder. The real landing page ships in WP-09 (MK-1).
// All copy below is verbatim from the spec (01-product.md §0.2, 02-design.md MK-1).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Show notes that sound like you — and never misquote you.
      </h1>
      <p className="max-w-xl text-balance text-base text-muted-foreground">
        Upload an episode. Get show notes, chapters, a blog post, a newsletter
        and social posts in minutes — in your voice, with every quote checked
        against the audio.
      </p>
      <p className="text-sm text-muted-foreground">
        EpisodeKit is being rebuilt. This page is a scaffold placeholder.
      </p>
    </main>
  );
}

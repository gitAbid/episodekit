import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-sm font-semibold">
        EpisodeKit
      </Link>
      {children}
    </div>
  );
}

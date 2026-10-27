import Link from "next/link";

export function AppHeader({
  showName,
  userButton,
}: {
  showName: string | null;
  userButton: React.ReactNode;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-4 px-4">
        <Link href="/app" className="text-sm font-semibold">
          EpisodeKit
        </Link>
        {showName ? <span className="text-sm font-medium">{showName}</span> : null}
        <span className="flex-1" />
        <Link href="/app/settings/show" className="text-sm underline">
          Settings
        </Link>
        {userButton}
      </div>
    </header>
  );
}

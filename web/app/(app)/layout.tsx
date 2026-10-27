import { UserButton } from "@clerk/nextjs";
import { AppHeader } from "@/components/app/app-header";
import { FeedbackWidget } from "@/components/app/feedback-widget";
import { requireUser } from "@/lib/auth";
import { isClerkConfigured } from "@/lib/env";
import { getShowByOwnerSafe } from "@/lib/show/queries-safe";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUser();
  const show = await getShowByOwnerSafe(userId);
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        showName={show?.name ?? null}
        userButton={isClerkConfigured() ? <UserButton /> : null}
      />
      {/* Pages sit in a 3xl column; the episode workspace (MK-6) is full width. */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 has-[[data-workspace]]:max-w-none has-[[data-workspace]]:p-0">
        {children}
      </main>
      <FeedbackWidget />
    </div>
  );
}

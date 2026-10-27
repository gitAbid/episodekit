export const metadata = { title: "Settings · EpisodeKit" };

/** Account settings (profile, sign-out) are handled by Clerk; page ships later. */
export default function SettingsAccountPage() {
  return (
    <div className="rounded-lg border p-6" data-testid="account-stub">
      <h2 className="text-base font-semibold">Account</h2>
      <p className="mt-1 text-sm text-neutral-500">This page is coming soon.</p>
    </div>
  );
}

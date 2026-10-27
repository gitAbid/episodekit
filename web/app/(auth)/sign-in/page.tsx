import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { KEYLESS_PREVIEW_MESSAGE } from "@/lib/auth";
import { isClerkConfigured } from "@/lib/env";

export const metadata = { title: "Sign in · EpisodeKit" };

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return (
      <div className="w-full max-w-sm rounded-lg border p-6 text-center" data-testid="sign-in-unconfigured">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-2 text-sm">{KEYLESS_PREVIEW_MESSAGE}</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Back to home
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm">
      <SignIn signInUrl="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/app" />
    </div>
  );
}

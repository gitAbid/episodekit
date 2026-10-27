import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { KEYLESS_PREVIEW_MESSAGE } from "@/lib/auth";
import { isClerkConfigured } from "@/lib/env";

export const metadata = { title: "Sign up · EpisodeKit" };

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return (
      <div className="w-full max-w-sm rounded-lg border p-6 text-center" data-testid="sign-up-unconfigured">
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="mt-2 text-sm">{KEYLESS_PREVIEW_MESSAGE}</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Back to home
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/app/onboarding/show" />
    </div>
  );
}

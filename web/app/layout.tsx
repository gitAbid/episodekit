import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/env";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// §5.2 type: Inter via next/font.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EpisodeKit",
  description:
    "Show notes that sound like you — and never misquote you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const clerk = isClerkConfigured();
  const body = (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
  if (!clerk) {
    // Keyless preview/CI: render without a provider — no keys are faked.
    return body;
  }
  return (
    <ClerkProvider
      appearance={{ variables: { colorPrimary: "#2457d6" } }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {body}
    </ClerkProvider>
  );
}

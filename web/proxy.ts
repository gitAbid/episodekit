import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextMiddleware } from "next/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/env";

/**
 * Next.js 16 proxy convention (formerly middleware.ts).
 * When Clerk keys are configured, clerkMiddleware makes server-side auth()
 * work across the app. Without keys (keyless preview/CI) it passes through.
 */
let handler: NextMiddleware | null = null;

const proxy: NextMiddleware = (req, evt) => {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }
  handler ??= clerkMiddleware();
  return handler(req, evt);
};

export default proxy;

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.[\\w]+$).*)"],
};

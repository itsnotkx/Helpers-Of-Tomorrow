import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/", "/dashboard(.*)"]);

export default clerkMiddleware(async(auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId, orgId, orgRole } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/not-member", req.url));
    }

    if (!orgId) {
      return NextResponse.redirect(new URL("/not-member", req.url));
    }

    if (orgRole === "org:member") {
      return NextResponse.redirect(new URL("/volunteer", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/", "/dashboard(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
   try {
      const user = await auth.protect();
      const role = user.publicMetadata.role;

      if (!role) {
        // User has no role set → not part of the org
        return NextResponse.redirect(new URL("/not-member", req.url));
      }
      
      // Role check
      if (user.publicMetadata.role === "org:member") {
        console.log("Redirecting org:member to /volunteer");
        return NextResponse.redirect(new URL("/volunteer", req.url));
      }

    } catch (err) {
      // If not authenticated, redirect to /volunteer
      return NextResponse.redirect(new URL("/volunteer", req.url));
    }
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
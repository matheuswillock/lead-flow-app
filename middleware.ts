import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/auth-sessions"

// Define protected route prefixes (actual URL paths)
const protectedPrefixes = ["/dashboard", "/account", "/board"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  // Always refresh Supabase session cookies via helper
  const { user, response } = await updateSession(request)

  // If the user is logged in and is trying to access auth pages, redirect to dashboard
  const authPages = ["/login", "/sign-in", "/sign-up"]
  if (user && authPages.includes(pathname)) {
    return NextResponse.redirect(new URL("/board", request.url))
  }

  // If route is not protected, let it pass while preserving any updated cookies
  if (!isProtected) return response

  // If not authenticated, redirect to sign-in
  if (!user) {
    const signInUrl = new URL("/sign-in", request.url)
    return NextResponse.redirect(signInUrl)
  }

  // User is authenticated; continue with refreshed cookies
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

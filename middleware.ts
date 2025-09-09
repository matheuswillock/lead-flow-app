import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/auth-sessions"

// Define protected route prefixes (actual URL paths)
const protectedPrefixes = ["/dashboard", "/account", "/board"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))
  const dev = process.env.NODE_ENV === 'development'

  const { user, response } = await updateSession(request)
  if (dev) {
    console.info('[middleware] path', pathname, 'protected?', isProtected, 'user?', !!user)
  }

  // If the user is logged in and is trying to access auth pages, redirect to dashboard
  const authPages = ["/login", "/sign-in", "/sign-up"]
  if (user && authPages.includes(pathname)) {
  if (dev) console.info('[middleware] redirect authenticated user away from auth page')
    return NextResponse.redirect(new URL("/board", request.url))
  }

  // If route is not protected, let it pass while preserving any updated cookies
  if (!isProtected) return response

  // If not authenticated, redirect to sign-in
  if (!user) {
  if (dev) console.info('[middleware] unauthenticated -> redirect to /sign-in')
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

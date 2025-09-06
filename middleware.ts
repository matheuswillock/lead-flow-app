import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")
  if (!isDashboard) return NextResponse.next()

  const supa = req.cookies.get("sb-access-token") || req.cookies.get("sb:token") // cookies supabase
  if (!supa) {
    const signInUrl = new URL("/sign-in", req.url)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}

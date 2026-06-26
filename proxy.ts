import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/auth-sessions"
import { isManagerLikeRole, isBackofficeRole } from "@/lib/roles"
import * as Sentry from "@sentry/nextjs"

// Define protected route prefixes (actual URL paths)
const protectedPrefixes = ["/dashboard", "/account", "/crm", "/board", "/pipeline", "/manager-users", "/notifications", "/integrations", "/docs", "/pme-simulador"]

// Public routes that don't require authentication
const publicRoutes = ["/", "/sign-in", "/operator-confirmed", "/pix-confirmed", "/set-password", "/forgot-password", "/adesao/expirado"]

// Routes that require manager role
const managerOnlyRoutes = ["/manager-users", "/integrations"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  try {
  // Sentry tunnel is production-only; stale client bundles may still POST here in dev.
  if (pathname === "/monitoring" || pathname.startsWith("/monitoring/")) {
    if (process.env.NODE_ENV !== "production") {
      return new NextResponse(null, { status: 204 });
    }
  }

  // Skip Proxy completely for webhook routes
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next();
  }
  
  // Always refresh Supabase session cookies via helper
  const { user, response } = await updateSession(request)

  if (pathname === "/subscribe") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (pathname.startsWith("/adesao/") && pathname !== "/adesao/expirado") {
    const token = pathname.split("/").filter(Boolean)[1]
    const { validateBackofficeAdhesionToken } = await import(
      "@/lib/backoffice-adhesions/adhesion-token-validation"
    )
    const validation = await validateBackofficeAdhesionToken(token)

    if (validation.status !== "valid") {
      return NextResponse.redirect(new URL("/adesao/expirado", request.url))
    }

    return response
  }

  // Check if it's a public route - let it pass
  if (publicRoutes.includes(pathname)) {
    return response
  }

  // Backoffice sign-in page: public within /backoffice
  if (pathname === '/backoffice/sign-in') {
    // Already authenticated as backoffice → redirect to app
    if (user) {
      try {
        const { prisma } = await import('@/app/api/infra/data/prisma')
        const profile = await prisma.profile.findUnique({
          where: { supabaseId: user.id },
          select: { role: true },
        })
        if (profile && isBackofficeRole(profile.role)) {
          return NextResponse.redirect(new URL('/backoffice', request.url))
        }
      } catch {
        // fail-open: show sign-in page
      }
    }
    return response
  }

  // Protect all other /backoffice routes — backoffice role only
  if (pathname.startsWith('/backoffice')) {
    if (!user) {
      return NextResponse.redirect(new URL('/backoffice/sign-in', request.url))
    }
    try {
      const { prisma } = await import('@/app/api/infra/data/prisma')
      const profile = await prisma.profile.findUnique({
        where: { supabaseId: user.id },
        select: { role: true },
      })
      if (!profile || !isBackofficeRole(profile.role)) {
        // Authenticated but not backoffice → redirect to their CRM
        return NextResponse.redirect(new URL(`/${user.id}/crm`, request.url))
      }
    } catch (error) {
      console.error('[Proxy] Error verifying backoffice role:', error)
      return NextResponse.redirect(new URL('/backoffice/sign-in', request.url))
    }
    return response
  }

  // Check if it's a protected route (with or without supabaseId)
  const isProtectedRoute = protectedPrefixes.some((prefix) => {
    // Check for direct route (old format)
    if (pathname.startsWith(prefix)) return true
    // Check for supabaseId route (new format: /[supabaseId]/route)
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length >= 2) {
      const potentialRoute = `/${pathSegments[1]}`
      return protectedPrefixes.includes(potentialRoute)
    }
    return false
  })

  // Check if it's a manager-only route
  const isManagerOnlyRoute = managerOnlyRoutes.some((route) => {
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length >= 2) {
      const potentialRoute = `/${pathSegments[1]}`
      return route === potentialRoute
    }
    return pathname.startsWith(route)
  })

  // If the user is logged in and is trying to access auth pages, redirect to CRM with supabaseId
  const authPages = ["/login", "/sign-in"]
  if (user && authPages.includes(pathname)) {
    const url = new URL(`/${user.id}/crm`, request.url)
    url.search = request.nextUrl.search
    return NextResponse.redirect(url)
  }

  // For API routes, handle authentication and add user ID to headers
  if (pathname.startsWith('/api')) {
    // API routes don't need protection check - they handle their own auth
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-supabase-user-id')
    if (user) {
      requestHeaders.set('x-supabase-user-id', user.id)
    }
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // If route is not protected, let it pass while preserving any updated cookies
  if (!isProtectedRoute) return response

  // If not authenticated, redirect to sign-in
  if (!user) {
    const signInUrl = new URL("/sign-in", request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Check if user is accessing a route with the correct supabaseId
  const pathSegments = pathname.split('/').filter(Boolean)
  
  // If accessing old format route (without supabaseId), redirect to new format
  // EXCEPTION: keep "/subscribe" at root-level (no tenantized path)
  if (protectedPrefixes.some(prefix => pathname.startsWith(prefix))) {
    const routeName = pathSegments[0]
    if (routeName !== 'subscribe') {
      const url = new URL(`/${user.id}/${routeName}`, request.url)
      url.search = request.nextUrl.search
      return NextResponse.redirect(url)
    }
  }

  // If accessing route with supabaseId, verify it matches the current user
  if (pathSegments.length >= 2) {
    const urlSupabaseId = pathSegments[0]
    const routeName = pathSegments[1]
    
    // If the supabaseId in URL doesn't match the authenticated user, redirect to correct URL
    if (urlSupabaseId !== user.id) {
      const url = new URL(`/${user.id}/${routeName}`, request.url)
      url.search = request.nextUrl.search
      return NextResponse.redirect(url)
    }
  }

  // Additional check for manager-only routes (ONLY for page routes, not API)
  if (isManagerOnlyRoute && user) {
    try {
      console.info('[Proxy] Checking manager role for user:', user.id)
      
      // Buscar role diretamente do banco de dados (sem fetch interno)
      const { prisma } = await import('@/app/api/infra/data/prisma')
      const profile = await prisma.profile.findUnique({
        where: { supabaseId: user.id },
        select: { role: true, id: true }
      })
      
      if (!profile) {
        console.warn(`[Proxy] Profile not found for user ${user.id}, redirecting to dashboard`)
        return NextResponse.redirect(new URL(`/${user.id}/dashboard`, request.url))
      }
      
      // Se não for manager, redirecionar para dashboard
      if (!isManagerLikeRole(profile.role)) {
        console.info(`[Proxy] User ${user.id} is ${profile.role}, not a manager, redirecting to dashboard`)
        return NextResponse.redirect(new URL(`/${user.id}/dashboard`, request.url))
      }
      
      console.info(`[Proxy] User ${user.id} is a manager, allowing access to ${pathname}`)
    } catch (error) {
      console.error('[Proxy] Error verifying user role:', error)
      // Em caso de erro, permitir acesso (fail-open para não bloquear usuários legítimos)
      console.warn('[Proxy] Failed to verify role, allowing access (fail-open)')
    }
  }

  // User is authenticated and accessing correct route; continue with refreshed cookies
  return response
  } catch (error) {
    Sentry.captureException(error, {
      tags: { layer: "middleware" },
      extra: { pathname },
    })
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

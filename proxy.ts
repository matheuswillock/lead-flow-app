import { NextResponse, type NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"
import {
  isAuthRedirectRoute,
  isPublicPageRoute,
  isSensitiveRoute,
  isLegacyTenantRoute,
  parseTenantPath,
  requiresAuth,
  requiresManagerRole,
} from "@/lib/proxy/route-access"
import { resolveProfileRoleForProxy } from "@/lib/proxy/resolve-profile-role"
import { isBackofficeRole, isManagerLikeRole } from "@/lib/roles"
import {
  nextWithSession,
  redirectWithSession,
  updateSession,
} from "@/lib/supabase/auth-sessions"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  try {
    if (pathname === "/monitoring" || pathname.startsWith("/monitoring/")) {
      if (process.env.NODE_ENV !== "production") {
        return new NextResponse(null, { status: 204 })
      }
    }

    if (pathname.startsWith("/api/webhooks")) {
      return NextResponse.next()
    }

    const { user, response } = await updateSession(request)

    if (pathname === "/subscribe") {
      return redirectWithSession(response, new URL("/", request.url))
    }

    if (pathname.startsWith("/adesao/") && pathname !== "/adesao/expirado") {
      const token = pathname.split("/").filter(Boolean)[1]
      const { validateBackofficeAdhesionToken } = await import(
        "@/lib/backoffice-adhesions/adhesion-token-validation"
      )
      const validation = await validateBackofficeAdhesionToken(token)

      if (validation.status !== "valid") {
        return redirectWithSession(response, new URL("/adesao/expirado", request.url))
      }

      return response
    }

    if (
      user &&
      isAuthRedirectRoute(pathname)
    ) {
      const url = new URL(`/${user.id}/crm`, request.url)
      url.search = request.nextUrl.search
      return redirectWithSession(response, url)
    }

    if (isPublicPageRoute(pathname)) {
      return response
    }

    if (pathname === "/backoffice/sign-in") {
      if (user) {
        try {
          const profile = await resolveProfileRoleForProxy(user.id)
          if (profile && isBackofficeRole(profile.role)) {
            return redirectWithSession(response, new URL("/backoffice", request.url))
          }
        } catch {
          // fail-open: show sign-in page
        }
      }
      return response
    }

    if (pathname.startsWith("/backoffice")) {
      if (!user) {
        return redirectWithSession(response, new URL("/backoffice/sign-in", request.url))
      }

      try {
        const profile = await resolveProfileRoleForProxy(user.id)
        if (!profile || !isBackofficeRole(profile.role)) {
          return redirectWithSession(response, new URL(`/${user.id}/crm`, request.url))
        }
      } catch (error) {
        console.error("[Proxy] Error verifying backoffice role:", error)
        return redirectWithSession(response, new URL("/backoffice/sign-in", request.url))
      }

      return response
    }

    if (pathname.startsWith("/api")) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.delete("x-supabase-user-id")
      if (user) {
        requestHeaders.set("x-supabase-user-id", user.id)
      }

      return nextWithSession(response, {
        request: {
          headers: requestHeaders,
        },
      })
    }

    if (requiresAuth(pathname)) {
      if (!user) {
        return redirectWithSession(response, new URL("/sign-in", request.url))
      }

      if (isLegacyTenantRoute(pathname)) {
        const url = new URL(`/${user.id}${pathname}`, request.url)
        url.search = request.nextUrl.search
        return redirectWithSession(response, url)
      }

      const tenantPath = parseTenantPath(pathname)
      if (tenantPath && tenantPath.tenantId !== user.id) {
        const url = new URL(`/${user.id}${tenantPath.routePath}`, request.url)
        url.search = request.nextUrl.search
        return redirectWithSession(response, url)
      }

      if (requiresManagerRole(pathname)) {
        try {
          const profile = await resolveProfileRoleForProxy(user.id)

          if (!profile || !isManagerLikeRole(profile.role)) {
            return redirectWithSession(
              response,
              new URL(`/${user.id}/dashboard`, request.url),
            )
          }
        } catch (error) {
          console.error("[Proxy] Error verifying user role:", error)
          return redirectWithSession(
            response,
            new URL(`/${user.id}/dashboard`, request.url),
          )
        }
      }

      return response
    }

    return response
  } catch (error) {
    Sentry.captureException(error, {
      tags: { layer: "proxy" },
      extra: { pathname },
    })

    if (isSensitiveRoute(pathname)) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 },
        )
      }

      if (pathname.startsWith("/backoffice")) {
        return NextResponse.redirect(new URL("/backoffice/sign-in", request.url))
      }

      return NextResponse.redirect(new URL("/sign-in", request.url))
    }

    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

import { NextResponse, type NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"
import {
  isAuthRedirectRoute,
  isBackofficeAppRoute,
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
  rewriteWithSession,
  updateSession,
} from "@/lib/supabase/auth-sessions"
import { API_CLIENT_SLUG } from "@/lib/route-map"
import { isE2eTestMode } from "@/lib/e2e/is-e2e-test-mode"

/** Prefixo público das chamadas client-side: /api/q/... */
const SLUG_PREFIX = `/api/${API_CLIENT_SLUG}/`

/** Prefixo interno reescrito — nunca exposto ao browser. */
const REAL_API_PREFIX = "/api/v1/"

/**
 * Rate limiting por IP, restrito às rotas /api/q/** para não penalizar
 * usuários legítimos em rotas de página. Janela: 60 s, máximo: 120 req.
 * Para ambientes multi-instância, migrar para Vercel KV.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT_MAX
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isClientApiSlug = pathname.startsWith(SLUG_PREFIX)

  // Rate limit only for the public client slug — before session work.
  if (isClientApiSlug) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    if (!checkApiRateLimit(ip)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      })
    }
  }

  try {
    if (pathname === "/monitoring" || pathname.startsWith("/monitoring/")) {
      if (process.env.NODE_ENV !== "production") {
        return new NextResponse(null, { status: 204 })
      }
    }

    if (pathname.startsWith("/api/webhooks")) {
      return NextResponse.next()
    }

    // Rota pública embedável: não depende de sessão. Early-return antes do
    // updateSession evita o round-trip de refresh do Supabase no caminho
    // quente do formulário (os headers de embed vêm do next.config.ts).
    if (
      pathname.startsWith("/lead-form") ||
      pathname.startsWith("/backoffice-lead-form") ||
      pathname.startsWith("/forms/") ||
      pathname.startsWith("/documentos")
    ) {
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

    if (isBackofficeAppRoute(pathname)) {
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

    // /api/v1/** e /api/q/** (slug client-side). O slug é reescrito para /api/v1
    // DEPOIS do refresh de sessão e da injeção de x-supabase-user-id — o early
    // rewrite anterior pulava isso e quebrava getTeamAccess() nas rotas mascaradas.
    if (pathname.startsWith("/api")) {
      const incomingHeader = request.headers.get("x-supabase-user-id")
      const requestHeaders = new Headers(request.headers)
      requestHeaders.delete("x-supabase-user-id")
      if (user) {
        requestHeaders.set("x-supabase-user-id", user.id)
      } else if (isE2eTestMode() && incomingHeader) {
        requestHeaders.set("x-supabase-user-id", incomingHeader)
      }

      if (isClientApiSlug) {
        const rest = pathname.slice(SLUG_PREFIX.length)
        const rewrittenUrl = request.nextUrl.clone()
        rewrittenUrl.pathname = REAL_API_PREFIX + rest

        const rewriteResponse = rewriteWithSession(response, rewrittenUrl, {
          request: {
            headers: requestHeaders,
          },
        })
        rewriteResponse.headers.set("X-Content-Type-Options", "nosniff")
        rewriteResponse.headers.set("X-Frame-Options", "DENY")
        return rewriteResponse
      }

      return nextWithSession(response, {
        request: {
          headers: requestHeaders,
        },
      })
    }

    // 308 permanent redirect: /{uuid}/cdp → /{uuid}/radar (R4 slug rename)
    const cdpRedirectMatch = /^\/([0-9a-f-]{36})(\/cdp)(\/.*)?$/i.exec(pathname)
    if (cdpRedirectMatch) {
      const redirectUrl = new URL(`/${cdpRedirectMatch[1]}/radar${cdpRedirectMatch[3] ?? ""}`, request.url)
      redirectUrl.search = request.nextUrl.search
      return NextResponse.redirect(redirectUrl, { status: 308 })
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

      if (isBackofficeAppRoute(pathname)) {
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

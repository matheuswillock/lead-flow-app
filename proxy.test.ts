import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
} from "bun:test"
import { UserRole } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import * as adhesionModule from "@/lib/backoffice-adhesions/adhesion-token-validation"
import * as profileRole from "@/lib/proxy/resolve-profile-role"
import * as authSessions from "@/lib/supabase/auth-sessions"
import { proxy } from "./proxy"

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const BASE_URL = "http://localhost:3000"

// Capturar implementações reais antes do spyOn — mockImplementation(authSessions.fn)
// após o spy aponta para o próprio spy e gera recursão infinita (bun:test).
const originalNextWithSession = authSessions.nextWithSession
const originalRewriteWithSession = authSessions.rewriteWithSession

let apiQIpSeq = 0

/** IP único por request /api/q — o rate-limit do proxy é module-level. */
function uniqueApiQHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  apiQIpSeq += 1
  return {
    "x-forwarded-for": `198.51.100.${(apiQIpSeq % 250) + 1}`,
    ...extra,
  }
}

/**
 * Ajusta as variáveis lidas por `isE2eTestMode()` e devolve o restaurador.
 * `undefined` remove a variável.
 */
function withE2eEnv(next: {
  e2e?: string
  appEnv?: string
  vercelEnv?: string
}): () => void {
  const keys = {
    E2E_TEST_MODE: next.e2e,
    APP_ENV: next.appEnv,
    VERCEL_ENV: next.vercelEnv,
  } as const
  const previous = Object.fromEntries(
    Object.keys(keys).map((key) => [key, process.env[key]]),
  )

  for (const [key, value] of Object.entries(keys)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function makeRequest(
  pathname: string,
  options?: { headers?: Record<string, string>; search?: string },
) {
  const url = new URL(pathname, BASE_URL)
  if (options?.search) {
    url.search = options.search.startsWith("?")
      ? options.search
      : `?${options.search}`
  }
  return new NextRequest(
    url,
    options?.headers ? { headers: options.headers } : undefined,
  )
}

function makeUser(id: string) {
  return { id, supabaseId: id, email: "user@test.com" }
}

function makeSession(user: ReturnType<typeof makeUser> | null) {
  return {
    user,
    response: NextResponse.next(),
    supabase: null,
  }
}

describe("proxy", () => {
  let updateSessionSpy: ReturnType<typeof spyOn>
  let resolveProfileRoleSpy: ReturnType<typeof spyOn>
  let captureExceptionSpy: ReturnType<typeof spyOn>
  let validateAdhesionTokenSpy: ReturnType<typeof spyOn>
  let nextWithSessionSpy: ReturnType<typeof spyOn>
  let rewriteWithSessionSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    updateSessionSpy = spyOn(authSessions, "updateSession")
    resolveProfileRoleSpy = spyOn(profileRole, "resolveProfileRoleForProxy")
    captureExceptionSpy = spyOn(Sentry, "captureException").mockImplementation(() => "")
    validateAdhesionTokenSpy = spyOn(
      adhesionModule,
      "validateBackofficeAdhesionToken",
    )
    nextWithSessionSpy = spyOn(authSessions, "nextWithSession").mockImplementation(
      ((...args: Parameters<typeof originalNextWithSession>) =>
        originalNextWithSession(...args)) as typeof originalNextWithSession,
    )
    rewriteWithSessionSpy = spyOn(authSessions, "rewriteWithSession").mockImplementation(
      ((...args: Parameters<typeof originalRewriteWithSession>) =>
        originalRewriteWithSession(...args)) as typeof originalRewriteWithSession,
    )

    updateSessionSpy.mockResolvedValue(makeSession(null))
    resolveProfileRoleSpy.mockResolvedValue(null)
    validateAdhesionTokenSpy.mockResolvedValue({
      status: "valid",
      adhesionId: null,
      expiresAt: null,
      adhesionStatus: null,
    })
  })

  afterEach(() => {
    updateSessionSpy.mockRestore()
    resolveProfileRoleSpy.mockRestore()
    captureExceptionSpy.mockRestore()
    validateAdhesionTokenSpy.mockRestore()
    nextWithSessionSpy.mockRestore()
    rewriteWithSessionSpy.mockRestore()
  })

  it("skips updateSession for webhook routes", async () => {
    const response = await proxy(makeRequest("/api/webhooks/asaas"))

    expect(updateSessionSpy).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("returns 204 for monitoring routes outside production", async () => {
    expect(process.env.NODE_ENV).not.toBe("production")

    const response = await proxy(makeRequest("/monitoring"))

    expect(updateSessionSpy).not.toHaveBeenCalled()
    expect(response.status).toBe(204)
  })

  it("allows unauthenticated access to sign-in", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(null))

    const response = await proxy(makeRequest("/sign-in"))

    expect(response.status).toBe(200)
  })

  it("redirects authenticated users away from sign-in", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

    const response = await proxy(makeRequest("/sign-in"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/${USER_A}/crm`)
  })

  it("redirects unauthenticated tenant routes to sign-in", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(null))

    const response = await proxy(makeRequest(`/${USER_A}/whatsapp`))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/sign-in`)
  })

  it("redirects tenant mismatch to the authenticated user tenant", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

    const response = await proxy(makeRequest(`/${USER_B}/crm`))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/${USER_A}/crm`)
  })

  it("redirects legacy tenant routes to tenantized paths", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

    const response = await proxy(makeRequest("/crm"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/${USER_A}/crm`)
  })

  it("injects x-supabase-user-id on API routes", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

    await proxy(makeRequest("/api/v1/leads"))

    expect(nextWithSessionSpy).toHaveBeenCalled()
    const init = nextWithSessionSpy.mock.calls[0]?.[1] as
      | { request?: { headers?: Headers } }
      | undefined
    expect(init?.request?.headers?.get("x-supabase-user-id")).toBe(USER_A)
  })

  it("overwrites spoofed x-supabase-user-id on API routes", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

    await proxy(
      makeRequest("/api/v1/leads", {
        headers: { "x-supabase-user-id": USER_B },
      }),
    )

    const init = nextWithSessionSpy.mock.calls[0]?.[1] as
      | { request?: { headers?: Headers } }
      | undefined
    expect(init?.request?.headers?.get("x-supabase-user-id")).toBe(USER_A)
  })

  describe("api/q client slug masking (regression)", () => {
    // Estas asserções descrevem o proxy FORA do modo E2E — em modo E2E o
    // `x-supabase-user-id` do cliente é permitido de propósito (20ce228c).
    // Sem neutralizar, quem segue a receita de e2e local do agents.md passa a
    // ter `.env.test` no worktree, o `bun test` carrega `E2E_TEST_MODE=true`
    // e este teste fica vermelho por ambiente — não por regressão de código.
    let restoreE2eEnv: (() => void) | null = null

    beforeEach(() => {
      restoreE2eEnv = withE2eEnv({ e2e: undefined, appEnv: undefined, vercelEnv: undefined })
    })

    afterEach(() => {
      restoreE2eEnv?.()
      restoreE2eEnv = null
    })

    function getRewriteUrl(callIndex = 0) {
      return rewriteWithSessionSpy.mock.calls[callIndex]?.[1] as URL | string
    }

    function getRewriteInit(callIndex = 0) {
      return rewriteWithSessionSpy.mock.calls[callIndex]?.[2] as
        | { request?: { headers?: Headers } }
        | undefined
    }

    it("does not early-rewrite before updateSession (getTeamAccess requires session header)", async () => {
      // Regression: early NextResponse.rewrite() skipped updateSession and
      // x-supabase-user-id injection, so getTeamAccess() returned 401.
      const callOrder: string[] = []
      updateSessionSpy.mockImplementation(async () => {
        callOrder.push("updateSession")
        return makeSession(makeUser(USER_A))
      })
      rewriteWithSessionSpy.mockImplementation(
        ((...args: Parameters<typeof originalRewriteWithSession>) => {
          callOrder.push("rewriteWithSession")
          return originalRewriteWithSession(...args)
        }) as typeof originalRewriteWithSession,
      )

      await proxy(makeRequest("/api/q/leads", { headers: uniqueApiQHeaders() }))

      expect(callOrder).toEqual(["updateSession", "rewriteWithSession"])
      expect(updateSessionSpy).toHaveBeenCalledTimes(1)
      expect(rewriteWithSessionSpy).toHaveBeenCalledTimes(1)
      expect(nextWithSessionSpy).not.toHaveBeenCalled()
    })

    it("rewrites /api/q to /api/v1 and injects x-supabase-user-id from session", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

      await proxy(makeRequest("/api/q/leads", { headers: uniqueApiQHeaders() }))

      expect(String(getRewriteUrl())).toBe(`${BASE_URL}/api/v1/leads`)
      expect(getRewriteInit()?.request?.headers?.get("x-supabase-user-id")).toBe(
        USER_A,
      )
    })

    it("overwrites spoofed x-supabase-user-id on /api/q routes", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

      await proxy(
        makeRequest("/api/q/teams/status-rules", {
          headers: uniqueApiQHeaders({ "x-supabase-user-id": USER_B }),
        }),
      )

      expect(getRewriteInit()?.request?.headers?.get("x-supabase-user-id")).toBe(
        USER_A,
      )
    })

    it("clears x-supabase-user-id on /api/q when there is no session user", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(null))

      await proxy(
        makeRequest("/api/q/notifications/unread-count", {
          headers: uniqueApiQHeaders({ "x-supabase-user-id": USER_B }),
        }),
      )

      expect(rewriteWithSessionSpy).toHaveBeenCalledTimes(1)
      expect(
        getRewriteInit()?.request?.headers?.get("x-supabase-user-id"),
      ).toBeNull()
      expect(String(getRewriteUrl())).toContain(
        "/api/v1/notifications/unread-count",
      )
    })

    it("preserves nested path and query string when rewriting /api/q", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))
      const teamId = "28f7b9e8-9516-4a08-864c-9ff3e085ba87"

      await proxy(
        makeRequest(`/api/q/teams/${teamId}/crm/filter-presets`, {
          headers: uniqueApiQHeaders(),
          search: "includeInactive=true",
        }),
      )

      const rewritten = new URL(String(getRewriteUrl()))
      expect(rewritten.pathname).toBe(
        `/api/v1/teams/${teamId}/crm/filter-presets`,
      )
      expect(rewritten.searchParams.get("includeInactive")).toBe("true")
      expect(rewritten.pathname.startsWith("/api/q")).toBe(false)
    })

    it("sets security headers on the rewritten /api/q response", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

      const response = await proxy(
        makeRequest("/api/q/health-plans", { headers: uniqueApiQHeaders() }),
      )

      expect(response.status).not.toBe(429)
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
      expect(response.headers.get("X-Frame-Options")).toBe("DENY")
    })

    it("uses rewriteWithSession (not nextWithSession) so session cookies survive the rewrite", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

      await proxy(
        makeRequest("/api/q/dashboard/summary", { headers: uniqueApiQHeaders() }),
      )

      expect(rewriteWithSessionSpy).toHaveBeenCalledTimes(1)
      expect(nextWithSessionSpy).not.toHaveBeenCalled()
    })

    it("rate-limits /api/q before updateSession and returns 429", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))
      const restoreEnv = withE2eEnv({ e2e: undefined, appEnv: undefined })

      try {
        // IP único por execução — o contador do proxy é module-level.
        const headers = uniqueApiQHeaders()
        const sessionCallsBefore = updateSessionSpy.mock.calls.length
        const rewriteCallsBefore = rewriteWithSessionSpy.mock.calls.length

        let lastStatus = 0
        for (let i = 0; i < 121; i++) {
          const response = await proxy(
            makeRequest("/api/q/leads", { headers }),
          )
          lastStatus = response.status
        }

        expect(lastStatus).toBe(429)
        expect(updateSessionSpy.mock.calls.length - sessionCallsBefore).toBe(120)
        expect(rewriteWithSessionSpy.mock.calls.length - rewriteCallsBefore).toBe(120)
      } finally {
        restoreEnv()
      }
    })

    /**
     * Regressão do 429 intermitente no job Playwright (PR #936): no CI não há
     * `x-forwarded-for`, então todos os workers colapsam no balde "unknown" e
     * estouram os 120 req/60 s da suíte inteira. O proxy devolvia 429 antes do
     * route handler — por isso nenhum bypass no rate-limit da rota resolvia.
     */
    it("não aplica rate-limit em /api/q sob E2E_TEST_MODE (regressão CI)", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))
      const restoreEnv = withE2eEnv({ e2e: "true", appEnv: "test", vercelEnv: undefined })

      try {
        // Sem x-forwarded-for: reproduz o balde "unknown" compartilhado do CI.
        const statuses = new Set<number>()
        for (let i = 0; i < 150; i++) {
          const response = await proxy(makeRequest("/api/q/leads"))
          statuses.add(response.status)
        }

        expect(statuses.has(429)).toBe(false)
      } finally {
        restoreEnv()
      }
    })

    it("mantém o rate-limit em produção mesmo com E2E_TEST_MODE setado", async () => {
      updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))
      const restoreEnv = withE2eEnv({
        e2e: "true",
        appEnv: "test",
        vercelEnv: "production",
      })

      try {
        const headers = uniqueApiQHeaders()
        let lastStatus = 0
        for (let i = 0; i < 121; i++) {
          const response = await proxy(makeRequest("/api/q/leads", { headers }))
          lastStatus = response.status
        }

        expect(lastStatus).toBe(429)
      } finally {
        restoreEnv()
      }
    })
  })

  it("redirects unauthenticated backoffice routes to backoffice sign-in", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(null))

    const response = await proxy(makeRequest("/backoffice/clients"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/backoffice/sign-in`)
  })

  it("redirects non-backoffice users away from backoffice routes", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))
    resolveProfileRoleSpy.mockResolvedValue({ role: UserRole.operator })

    const response = await proxy(makeRequest("/backoffice/clients"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/${USER_A}/crm`)
  })

  it("redirects non-manager users away from manager-only routes", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))
    resolveProfileRoleSpy.mockResolvedValue({ role: UserRole.operator })

    const response = await proxy(makeRequest(`/${USER_A}/manager-users`))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/${USER_A}/dashboard`)
  })

  it("fail-closes sensitive page routes when updateSession throws", async () => {
    updateSessionSpy.mockRejectedValue(new Error("session unavailable"))

    const response = await proxy(makeRequest(`/${USER_A}/crm`))

    expect(captureExceptionSpy).toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/sign-in`)
  })

  it("fail-closes sensitive backoffice routes when updateSession throws", async () => {
    updateSessionSpy.mockRejectedValue(new Error("session unavailable"))

    const response = await proxy(makeRequest("/backoffice/clients"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/backoffice/sign-in`)
  })

  it("allows non-sensitive routes to pass through when updateSession throws", async () => {
    updateSessionSpy.mockRejectedValue(new Error("session unavailable"))

    const response = await proxy(makeRequest("/terms"))

    expect(response.status).toBe(200)
  })

  it("308 redirects /{uuid}/cdp to /{uuid}/radar preserving query", async () => {
    updateSessionSpy.mockResolvedValue(makeSession(makeUser(USER_A)))

    const response = await proxy(makeRequest(`/${USER_A}/cdp?tab=segments`))

    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/${USER_A}/radar?tab=segments`)
  })
})

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

function makeRequest(
  pathname: string,
  options?: { headers?: Record<string, string> },
) {
  return new NextRequest(
    new URL(pathname, BASE_URL),
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

  beforeEach(() => {
    updateSessionSpy = spyOn(authSessions, "updateSession")
    resolveProfileRoleSpy = spyOn(profileRole, "resolveProfileRoleForProxy")
    captureExceptionSpy = spyOn(Sentry, "captureException").mockImplementation(() => "")
    validateAdhesionTokenSpy = spyOn(
      adhesionModule,
      "validateBackofficeAdhesionToken",
    )
    nextWithSessionSpy = spyOn(authSessions, "nextWithSession").mockImplementation(
      authSessions.nextWithSession,
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
})

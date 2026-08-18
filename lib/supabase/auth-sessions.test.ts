import { afterEach, describe, expect, it } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import {
  E2E_COOKIE_NAME,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SUPABASE_ID,
} from "@/lib/e2e/constants"
import { signE2eJwt } from "@/lib/e2e/e2e-jwt"
import {
  copySessionCookies,
  nextWithSession,
  rewriteWithSession,
  updateSession,
} from "@/lib/supabase/auth-sessions"

describe("auth-sessions rewriteWithSession", () => {
  it("copies session cookies onto the rewrite response", () => {
    const sessionResponse = NextResponse.next()
    sessionResponse.cookies.set({
      name: "sb-access-token",
      value: "session-token",
      path: "/",
    })

    const rewritten = rewriteWithSession(
      sessionResponse,
      "http://localhost:3000/api/v1/leads",
    )

    expect(rewritten.cookies.get("sb-access-token")?.value).toBe("session-token")
  })

  it("forwards request headers init like nextWithSession", () => {
    const sessionResponse = NextResponse.next()
    const headers = new Headers()
    headers.set("x-supabase-user-id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    const rewritten = rewriteWithSession(
      sessionResponse,
      "http://localhost:3000/api/v1/leads",
      { request: { headers } },
    )
    const nexted = nextWithSession(sessionResponse, { request: { headers } })

    // Ambos devem aceitar o mesmo formato de init (contrato do proxy).
    expect(rewritten).toBeInstanceOf(NextResponse)
    expect(nexted).toBeInstanceOf(NextResponse)
  })

  it("copySessionCookies is shared by next and rewrite helpers", () => {
    const from = NextResponse.next()
    from.cookies.set({ name: "sb-refresh-token", value: "refresh", path: "/" })
    const to = NextResponse.next()

    copySessionCookies(from, to)

    expect(to.cookies.get("sb-refresh-token")?.value).toBe("refresh")
  })
})

const E2E_SECRET = "e2e-jwt-test-secret-at-least-32-chars"
const E2E_ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "E2E_TEST_MODE",
  "APP_ENV",
  "E2E_JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

const originalE2eEnv: Record<string, string | undefined> = {}
for (const key of E2E_ENV_KEYS) {
  originalE2eEnv[key] = process.env[key]
}

function restoreE2eEnv() {
  const env = process.env as Record<string, string | undefined>
  for (const key of E2E_ENV_KEYS) {
    if (originalE2eEnv[key] === undefined) delete env[key]
    else env[key] = originalE2eEnv[key]
  }
}

function enableE2eTestMode() {
  const env = process.env as Record<string, string | undefined>
  env.NODE_ENV = "test"
  delete env.VERCEL_ENV
  env.E2E_TEST_MODE = "true"
  env.APP_ENV = "test"
  env.E2E_JWT_SECRET = E2E_SECRET
  delete env.NEXT_PUBLIC_SUPABASE_URL
  delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

function makeRequestWithE2eCookie(token: string) {
  return new NextRequest("http://localhost:3000/crm", {
    headers: { cookie: `${E2E_COOKIE_NAME}=${token}` },
  })
}

describe("auth-sessions updateSession E2E bypass", () => {
  afterEach(() => {
    restoreE2eEnv()
  })

  it("short-circuits before Supabase quando o JWT E2E é válido em modo de teste", async () => {
    enableE2eTestMode()
    const token = signE2eJwt()
    const result = await updateSession(makeRequestWithE2eCookie(token))

    expect(result.supabase).toBeNull()
    expect(result.user).toEqual({
      id: E2E_MASTER_SUPABASE_ID,
      email: E2E_MASTER_EMAIL,
      supabaseId: E2E_MASTER_SUPABASE_ID,
    })
  })

  it("aceita o cookie E2E quando NODE_ENV=production e APP_ENV=test (next start)", async () => {
    enableE2eTestMode()
    const token = signE2eJwt()
    const env = process.env as Record<string, string | undefined>
    env.NODE_ENV = "production"
    const result = await updateSession(makeRequestWithE2eCookie(token))

    expect(result.user).toEqual({
      id: E2E_MASTER_SUPABASE_ID,
      email: E2E_MASTER_EMAIL,
      supabaseId: E2E_MASTER_SUPABASE_ID,
    })
  })

  it("ignora o cookie E2E quando VERCEL_ENV=production", async () => {
    enableE2eTestMode()
    const token = signE2eJwt()
    const env = process.env as Record<string, string | undefined>
    env.VERCEL_ENV = "production"
    const result = await updateSession(makeRequestWithE2eCookie(token))

    expect(result.user).toBeNull()
  })
})

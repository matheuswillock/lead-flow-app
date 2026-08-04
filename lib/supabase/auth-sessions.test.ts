import { describe, expect, it } from "bun:test"
import { NextResponse } from "next/server"
import {
  copySessionCookies,
  nextWithSession,
  rewriteWithSession,
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

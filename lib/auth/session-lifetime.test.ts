import { describe, expect, it } from "bun:test"
import {
  extractSupabaseSessionId,
  formatAuthSessionBoundCookie,
  isAuthSessionExpired,
  MAX_AUTH_SESSION_MS,
  parseAuthSessionBoundCookie,
  resolveAuthSessionStartedAt,
} from "./session-lifetime"

describe("isAuthSessionExpired", () => {
  it("retorna false quando startedAt está ausente", () => {
    expect(isAuthSessionExpired(null)).toBe(false)
    expect(isAuthSessionExpired(undefined)).toBe(false)
    expect(isAuthSessionExpired(Number.NaN)).toBe(false)
  })

  it("retorna false dentro da janela de 6 horas", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    expect(isAuthSessionExpired(now - MAX_AUTH_SESSION_MS + 60_000, now)).toBe(false)
  })

  it("retorna true exatamente no limite de 6 horas", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    expect(isAuthSessionExpired(now - MAX_AUTH_SESSION_MS, now)).toBe(true)
  })

  it("retorna true após 6 horas", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    expect(isAuthSessionExpired(now - MAX_AUTH_SESSION_MS - 1, now)).toBe(true)
  })
})

describe("session bound cookie helpers", () => {
  it("serializa e parseia o cookie por session_id", () => {
    const encoded = formatAuthSessionBoundCookie("sess-1", 1_700_000_000_000)
    expect(parseAuthSessionBoundCookie(encoded)).toEqual({
      sessionId: "sess-1",
      startedAtMs: 1_700_000_000_000,
    })
  })

  it("mantém startedAt quando o session_id é o mesmo", () => {
    const startedAtMs = resolveAuthSessionStartedAt({
      sessionId: "sess-1",
      bound: { sessionId: "sess-1", startedAtMs: 100 },
      nowMs: 999,
    })
    expect(startedAtMs).toBe(100)
  })

  it("reinicia startedAt quando o session_id muda (novo login)", () => {
    const startedAtMs = resolveAuthSessionStartedAt({
      sessionId: "sess-2",
      bound: { sessionId: "sess-1", startedAtMs: 100 },
      nowMs: 999,
    })
    expect(startedAtMs).toBe(999)
  })
})

describe("extractSupabaseSessionId", () => {
  it("extrai session_id do JWT", () => {
    const payload = Buffer.from(
      JSON.stringify({ session_id: "abc-session", sub: "user-1" }),
      "utf8"
    ).toString("base64url")
    const token = `hdr.${payload}.sig`
    expect(extractSupabaseSessionId(token)).toBe("abc-session")
  })

  it("retorna null para token inválido", () => {
    expect(extractSupabaseSessionId(null)).toBeNull()
    expect(extractSupabaseSessionId("not-a-jwt")).toBeNull()
  })
})

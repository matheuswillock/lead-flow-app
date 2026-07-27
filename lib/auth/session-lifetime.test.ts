import { describe, expect, it } from "bun:test"
import {
  isAuthSessionExpired,
  MAX_AUTH_SESSION_MS,
} from "./session-lifetime"

describe("isAuthSessionExpired", () => {
  it("retorna false quando last_sign_in_at está ausente", () => {
    expect(isAuthSessionExpired(null)).toBe(false)
    expect(isAuthSessionExpired(undefined)).toBe(false)
    expect(isAuthSessionExpired("")).toBe(false)
  })

  it("retorna false dentro da janela de 6 horas", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    const signedIn = new Date(now - MAX_AUTH_SESSION_MS + 60_000).toISOString()
    expect(isAuthSessionExpired(signedIn, now)).toBe(false)
  })

  it("retorna true exatamente no limite de 6 horas", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    const signedIn = new Date(now - MAX_AUTH_SESSION_MS).toISOString()
    expect(isAuthSessionExpired(signedIn, now)).toBe(true)
  })

  it("retorna true após 6 horas", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    const signedIn = new Date(now - MAX_AUTH_SESSION_MS - 1).toISOString()
    expect(isAuthSessionExpired(signedIn, now)).toBe(true)
  })

  it("retorna false para data inválida", () => {
    expect(isAuthSessionExpired("not-a-date")).toBe(false)
  })
})

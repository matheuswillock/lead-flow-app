import { describe, expect, it } from "bun:test"
import { INVITE_LINK_TTL_SECONDS, signInviteLinkToken, verifyInviteLinkToken } from "./invite-link-token"

const SECRET = "test-secret-with-at-least-32-characters-x"
const NOW = Date.UTC(2026, 10, 23, 15, 0, 0)
const IDENTITY = { email: "ana@example.com", name: null, profileId: "profile-1", inviteLinkVersion: 0 }

describe("invite link token", () => {
  it("round trip devolve e-mail normalizado, nome, perfil e versão", () => {
    const token = signInviteLinkToken(
      { email: "  Ana@Example.com ", name: "Ana Souza", profileId: "profile-1", inviteLinkVersion: 3 },
      { nowMs: NOW, secret: SECRET }
    )

    const payload = verifyInviteLinkToken(token, { nowMs: NOW, secret: SECRET })

    expect(payload?.email).toBe("ana@example.com")
    expect(payload?.name).toBe("Ana Souza")
    expect(payload?.profileId).toBe("profile-1")
    expect(payload?.inviteLinkVersion).toBe(3)
    expect(payload?.expiresAt).toBe(Math.floor(NOW / 1000) + INVITE_LINK_TTL_SECONDS)
  })

  it("é reutilizável: verificar duas vezes dentro do prazo continua válido", () => {
    const token = signInviteLinkToken(IDENTITY, { nowMs: NOW, secret: SECRET })

    expect(verifyInviteLinkToken(token, { nowMs: NOW, secret: SECRET })).not.toBeNull()
    expect(verifyInviteLinkToken(token, { nowMs: NOW + 60_000, secret: SECRET })).not.toBeNull()
  })

  it("expira depois de 24 horas", () => {
    const token = signInviteLinkToken(IDENTITY, { nowMs: NOW, secret: SECRET })
    const justBefore = NOW + (INVITE_LINK_TTL_SECONDS - 1) * 1000
    const atExpiry = NOW + INVITE_LINK_TTL_SECONDS * 1000

    expect(verifyInviteLinkToken(token, { nowMs: justBefore, secret: SECRET })).not.toBeNull()
    expect(verifyInviteLinkToken(token, { nowMs: atExpiry, secret: SECRET })).toBeNull()
  })

  it("rejeita payload adulterado", () => {
    const token = signInviteLinkToken(IDENTITY, { nowMs: NOW, secret: SECRET })
    const [, signature] = token.split(".")
    const forged = Buffer.from(
      JSON.stringify({ e: "outra@example.com", n: null, x: 9_999_999_999, p: "profile-1", v: 0 })
    ).toString("base64url")

    expect(verifyInviteLinkToken(`${forged}.${signature}`, { nowMs: NOW, secret: SECRET })).toBeNull()
  })

  it("rejeita token sem perfil e versão (formato anterior ao controle de revogação)", () => {
    const legacy = Buffer.from(
      JSON.stringify({ e: "ana@example.com", n: null, x: Math.floor(NOW / 1000) + 3600 })
    ).toString("base64url")
    const crypto = new Bun.CryptoHasher("sha256", SECRET).update(legacy).digest("base64url")

    expect(verifyInviteLinkToken(`${legacy}.${crypto}`, { nowMs: NOW, secret: SECRET })).toBeNull()
  })

  it("rejeita token assinado com outro segredo", () => {
    const token = signInviteLinkToken(IDENTITY, { nowMs: NOW, secret: SECRET })

    expect(
      verifyInviteLinkToken(token, { nowMs: NOW, secret: "another-secret-with-at-least-32-characters" })
    ).toBeNull()
  })

  it("rejeita formatos malformados", () => {
    expect(verifyInviteLinkToken("", { nowMs: NOW, secret: SECRET })).toBeNull()
    expect(verifyInviteLinkToken("abc", { nowMs: NOW, secret: SECRET })).toBeNull()
    expect(verifyInviteLinkToken("a.b.c", { nowMs: NOW, secret: SECRET })).toBeNull()
  })

  it("sem INVITE_LINK_SECRET falha de forma explícita", () => {
    const previous = process.env.INVITE_LINK_SECRET
    delete process.env.INVITE_LINK_SECRET
    try {
      expect(() => signInviteLinkToken(IDENTITY, { nowMs: NOW })).toThrow("INVITE_LINK_SECRET")
    } finally {
      if (previous !== undefined) process.env.INVITE_LINK_SECRET = previous
    }
  })
})

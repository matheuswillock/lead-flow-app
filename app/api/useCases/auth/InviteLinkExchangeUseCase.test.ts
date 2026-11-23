import { describe, expect, it, mock } from "bun:test"
import { signInviteLinkToken } from "@/lib/auth/invite-link-token"
import { InviteLinkExchangeUseCase } from "./InviteLinkExchangeUseCase"

const SECRET = "test-secret-with-at-least-32-characters-x"
const NOW = Date.UTC(2026, 10, 23, 15, 0, 0)
const validToken = signInviteLinkToken({ email: "ana@example.com", name: "Ana" }, { nowMs: NOW, secret: SECRET })

function buildUseCase(overrides: {
  findAuthUserByEmail?: (email: string) => Promise<{ last_sign_in_at?: string | null } | null>
  generateInviteTokenHash?: (input: { email: string; name: string | null }) => Promise<string | null>
}) {
  const findAuthUserByEmail = overrides.findAuthUserByEmail ?? mock(async () => ({ last_sign_in_at: null }))
  const generateInviteTokenHash = overrides.generateInviteTokenHash ?? mock(async () => "hashed-token-new")
  const useCase = new InviteLinkExchangeUseCase(
    { findAuthUserByEmail, generateInviteTokenHash },
    { nowMs: NOW, secret: SECRET }
  )
  return { useCase, findAuthUserByEmail, generateInviteTokenHash }
}

describe("InviteLinkExchangeUseCase", () => {
  it("token inválido não toca no Supabase", async () => {
    const { useCase, findAuthUserByEmail, generateInviteTokenHash } = buildUseCase({})

    const output = await useCase.exchange("nao-e-um-token")

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "invalid" })
    expect(findAuthUserByEmail).not.toHaveBeenCalled()
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("usuário que já fez o primeiro acesso não recebe novo token (link vira inválido)", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findAuthUserByEmail: mock(async () => ({ last_sign_in_at: "2026-11-23T16:00:00Z" })),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "already_used" })
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("usuário pendente recebe token_hash novo gerado no clique", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findAuthUserByEmail: mock(async () => ({ last_sign_in_at: null })),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ tokenHash: "hashed-token-new" })
    expect(generateInviteTokenHash).toHaveBeenCalledWith({ email: "ana@example.com", name: "Ana" })
  })

  it("usuário ainda inexistente no Auth é criado pela geração do convite", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findAuthUserByEmail: mock(async () => null),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(true)
    expect(generateInviteTokenHash).toHaveBeenCalledTimes(1)
  })

  it("falha ao consultar o Auth devolve unavailable, nunca gera token", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findAuthUserByEmail: mock(async () => {
        throw new Error("supabase down")
      }),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "unavailable" })
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("falha ao gerar o token devolve unavailable", async () => {
    const { useCase } = buildUseCase({
      generateInviteTokenHash: mock(async () => null),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "unavailable" })
  })
})

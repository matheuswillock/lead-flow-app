import { describe, expect, it, mock } from "bun:test"
import { signInviteLinkToken } from "@/lib/auth/invite-link-token"
import { InviteLinkExchangeUseCase, type InviteLinkProfile } from "./InviteLinkExchangeUseCase"

const SECRET = "test-secret-with-at-least-32-characters-x"
const NOW = Date.UTC(2026, 10, 23, 15, 0, 0)
const IDENTITY = { email: "ana@example.com", name: "Ana", profileId: "profile-1", inviteLinkVersion: 2 }
const validToken = signInviteLinkToken(IDENTITY, { nowMs: NOW, secret: SECRET })

const activeProfile: InviteLinkProfile = {
  email: "ana@example.com",
  inviteLinkVersion: 2,
  deleted: false,
}

function buildUseCase(overrides: {
  findProfileById?: (profileId: string) => Promise<InviteLinkProfile | null>
  findAuthUserByEmail?: (email: string) => Promise<{ last_sign_in_at?: string | null } | null>
  generateInviteTokenHash?: (input: { email: string; name: string | null }) => Promise<string | null>
}) {
  const findProfileById = overrides.findProfileById ?? mock(async () => activeProfile)
  const findAuthUserByEmail = overrides.findAuthUserByEmail ?? mock(async () => ({ last_sign_in_at: null }))
  const generateInviteTokenHash = overrides.generateInviteTokenHash ?? mock(async () => "hashed-token-new")
  const useCase = new InviteLinkExchangeUseCase(
    { findProfileById, findAuthUserByEmail, generateInviteTokenHash },
    { nowMs: NOW, secret: SECRET }
  )
  return { useCase, findProfileById, findAuthUserByEmail, generateInviteTokenHash }
}

describe("InviteLinkExchangeUseCase", () => {
  it("token inválido não toca no Supabase nem no banco", async () => {
    const { useCase, findProfileById, findAuthUserByEmail, generateInviteTokenHash } = buildUseCase({})

    const output = await useCase.exchange("nao-e-um-token")

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "invalid" })
    expect(findProfileById).not.toHaveBeenCalled()
    expect(findAuthUserByEmail).not.toHaveBeenCalled()
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("convite revogado (vínculo removido, versão incrementada) é recusado sem gerar token", async () => {
    const { useCase, findAuthUserByEmail, generateInviteTokenHash } = buildUseCase({
      findProfileById: mock(async () => ({ ...activeProfile, inviteLinkVersion: 3 })),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "invalid" })
    expect(findAuthUserByEmail).not.toHaveBeenCalled()
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("perfil excluído é recusado mesmo com token íntegro e dentro do prazo", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findProfileById: mock(async () => ({ ...activeProfile, deleted: true })),
    })

    const output = await useCase.exchange(validToken)

    expect(output.result).toEqual({ reason: "invalid" })
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("perfil inexistente é recusado", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findProfileById: mock(async () => null),
    })

    const output = await useCase.exchange(validToken)

    expect(output.result).toEqual({ reason: "invalid" })
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("e-mail do perfil trocado depois do envio invalida o link antigo", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findProfileById: mock(async () => ({ ...activeProfile, email: "nova@example.com" })),
    })

    const output = await useCase.exchange(validToken)

    expect(output.result).toEqual({ reason: "invalid" })
    expect(generateInviteTokenHash).not.toHaveBeenCalled()
  })

  it("falha ao consultar o perfil devolve unavailable, nunca gera token", async () => {
    const { useCase, generateInviteTokenHash } = buildUseCase({
      findProfileById: mock(async () => {
        throw new Error("db down")
      }),
    })

    const output = await useCase.exchange(validToken)

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ reason: "unavailable" })
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

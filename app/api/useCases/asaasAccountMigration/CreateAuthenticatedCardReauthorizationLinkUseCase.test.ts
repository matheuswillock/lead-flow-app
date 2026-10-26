import { describe, expect, it, mock } from "bun:test"
import { CreateAuthenticatedCardReauthorizationLinkUseCase } from "./CreateAuthenticatedCardReauthorizationLinkUseCase"

const eligibleMigration = {
  id: "migration-1",
  isBanned: false,
  primaryCustomerId: "cus_primary",
  status: "paused_awaiting_card",
  quoteSnapshot: { value: 59.9 },
  isPaymentPaused: true,
}

describe("CreateAuthenticatedCardReauthorizationLinkUseCase", () => {
  it("emite um token apenas para o master com migração pronta para recuperar", async () => {
    const createdTokens: Array<{ migrationId: string; expiresAt: Date }> = []
    const useCase = new CreateAuthenticatedCardReauthorizationLinkUseCase({
      recoveryRepository: { findRecoveryMigrationForAuthenticatedMaster: async () => eligibleMigration },
      tokenRepository: {
        createToken: async (migrationId, expiresAt) => {
          createdTokens.push({ migrationId, expiresAt })
          return "secure-token"
        },
      },
      now: () => new Date("2026-10-11T12:00:00.000Z"),
    })

    const output = await useCase.execute({ supabaseId: "master-supabase-id" })

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ token: "secure-token" })
    expect(createdTokens[0]?.migrationId).toBe("migration-1")
    expect(createdTokens[0]?.expiresAt.toISOString()).toBe("2026-10-18T12:00:00.000Z")
  })

  it("não emite token para uma migração sem customer na conta primary", async () => {
    const useCase = new CreateAuthenticatedCardReauthorizationLinkUseCase({
      recoveryRepository: {
        findRecoveryMigrationForAuthenticatedMaster: async () => ({ ...eligibleMigration, primaryCustomerId: null }),
      },
      tokenRepository: { createToken: async () => "should-not-be-called" },
    })

    const output = await useCase.execute({ supabaseId: "master-supabase-id" })

    expect(output.isValid).toBe(false)
  })
  it("não emite token antes da conta ficar pausada", async () => {
    const createToken = mock(async () => "should-not-be-called")
    const useCase = new CreateAuthenticatedCardReauthorizationLinkUseCase({
      recoveryRepository: { findRecoveryMigrationForAuthenticatedMaster: async () => ({ ...eligibleMigration, isPaymentPaused: false }) },
      tokenRepository: { createToken },
    })

    const output = await useCase.execute({ supabaseId: "master-supabase-id" })

    expect(output.isValid).toBe(false)
    expect(createToken).not.toHaveBeenCalled()
  })

  it("não abre checkout sem snapshot de cobrança", async () => {
    const useCase = new CreateAuthenticatedCardReauthorizationLinkUseCase({
      recoveryRepository: { findRecoveryMigrationForAuthenticatedMaster: async () => ({ ...eligibleMigration, quoteSnapshot: null }) },
      tokenRepository: { createToken: async () => "should-not-be-called" },
    })

    expect((await useCase.execute({ supabaseId: "master-supabase-id" })).isValid).toBe(false)
  })
})

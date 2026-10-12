import { describe, expect, it, mock } from "bun:test"
import { CardReauthorizationUseCase } from "./CardReauthorizationUseCase"

function record() {
  return {
    id: "reauth-1",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    isBanned: false,
    migration: {
      clientName: "Cliente",
      status: "paused_awaiting_card",
      quoteSnapshot: { billingOwnerId: "profile-1", recurringAmount: 79.8, billingCycle: "monthly" },
      legacyCustomerId: "cus_legacy",
      primaryCustomerId: "cus_primary",
    },
  }
}

describe("CardReauthorizationUseCase concorrência", () => {
  it("bloqueia master banido antes de expor contexto ou tokenizar cartão", async () => {
    const tokenizeCard = mock(async () => ({ token: "asaas-token" }))
    const tokenRepository = {
      findForMaster: mock(async () => ({ ...record(), isBanned: true })),
      claimForProcessing: mock(async () => ({ kind: "claimed", attemptId: "attempt-1", attemptReference: "card-attempt:attempt-1" })),
      releaseProcessing: mock(async () => true),
      markUsed: mock(async () => undefined),
      completeAttempt: mock(async () => undefined),
    }
    const useCase = new CardReauthorizationUseCase({
      tokenRepository: tokenRepository as any,
      migrationUseCase: {} as any,
      migrationGateway: { tokenizeCard } as any,
    })

    const context = await useCase.getContext("token", "master")
    const result = await useCase.submit({
      token: "token",
      supabaseId: "master",
      card: { holderName: "Cliente", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      cardholder: { name: "Cliente", email: "cliente@example.com", cpfCnpj: "12345678901", postalCode: "01001000", addressNumber: "1" },
      remoteIp: "203.0.113.10",
    })

    expect(context.isValid).toBe(false)
    expect(context.result).toEqual({ reason: "banned" })
    expect(result.isValid).toBe(false)
    expect(result.result).toEqual({ reason: "banned" })
    expect(tokenizeCard).not.toHaveBeenCalled()
    expect(tokenRepository.claimForProcessing).not.toHaveBeenCalled()
  })

  it("não tokeniza nem cobra quando outro request já possui o claim", async () => {
    const tokenizeCard = mock(async () => ({ token: "asaas-token" }))
    const useCase = new CardReauthorizationUseCase({
      tokenRepository: {
        findForMaster: mock(async () => record()),
        claimForProcessing: mock(async () => ({ kind: "already_processing" })),
        releaseProcessing: mock(async () => true),
        markUsed: mock(async () => undefined),
        completeAttempt: mock(async () => true),
      } as any,
      migrationUseCase: {} as any,
      migrationGateway: { tokenizeCard } as any,
    })

    const result = await useCase.submit({
      token: "token",
      supabaseId: "master",
      card: { holderName: "Cliente", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      cardholder: { name: "Cliente", email: "cliente@example.com", cpfCnpj: "12345678901", postalCode: "01001000", addressNumber: "1" },
      remoteIp: "203.0.113.10",
    })

    expect(result.isValid).toBe(false)
    expect(result.errorMessages[0]).toContain("processamento")
    expect(tokenizeCard).not.toHaveBeenCalled()
  })

  it("retorna rate limit antes de tokenizar depois de cinco recusas", async () => {
    const tokenizeCard = mock(async () => ({ token: "asaas-token" }))
    const retryAt = new Date("2026-10-11T12:00:00.000Z")
    const useCase = new CardReauthorizationUseCase({
      tokenRepository: {
        findForMaster: mock(async () => record()),
        claimForProcessing: mock(async () => ({ kind: "rate_limited", retryAt })),
        releaseProcessing: mock(async () => true),
        markUsed: mock(async () => undefined),
        completeAttempt: mock(async () => true),
      } as any,
      migrationUseCase: {} as any,
      migrationGateway: { tokenizeCard } as any,
    })

    const result = await useCase.submit({
      token: "token",
      supabaseId: "master",
      card: { holderName: "Cliente", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      cardholder: { name: "Cliente", email: "cliente@example.com", cpfCnpj: "12345678901", postalCode: "01001000", addressNumber: "1" },
      remoteIp: "203.0.113.10",
    })

    expect(result.isValid).toBe(false)
    expect(result.result).toEqual({ reason: "rate_limited", retryAt })
    expect(tokenizeCard).not.toHaveBeenCalled()
  })

  it("registra recusa conhecida e libera o claim", async () => {
    const completeAttempt = mock(async () => true)
    const releaseProcessing = mock(async () => true)
    const useCase = new CardReauthorizationUseCase({
      tokenRepository: {
        findForMaster: mock(async () => record()),
        claimForProcessing: mock(async () => ({ kind: "claimed", attemptId: "attempt-1", attemptReference: "asaas-card-attempt:attempt-1" })),
        releaseProcessing,
        markUsed: mock(async () => undefined),
        completeAttempt,
      } as any,
      migrationUseCase: { execute: mock(async () => ({ isValid: false, errorMessages: ["Pagamento recusado"], result: { reason: "declined" } })) } as any,
      migrationGateway: { tokenizeCard: mock(async () => ({ token: "asaas-token" })) } as any,
    })

    const result = await useCase.submit({
      token: "token",
      supabaseId: "master",
      card: { holderName: "Cliente", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      cardholder: { name: "Cliente", email: "cliente@example.com", cpfCnpj: "12345678901", postalCode: "01001000", addressNumber: "1" },
      remoteIp: "203.0.113.10",
    })

    expect(result.isValid).toBe(false)
    expect(completeAttempt).toHaveBeenCalledWith(expect.objectContaining({ status: "declined", failureCode: "PAYMENT_DECLINED" }))
    expect(releaseProcessing).toHaveBeenCalled()
  })

  it("registra outcome unknown e mantém o claim até expirar", async () => {
    const completeAttempt = mock(async () => true)
    const releaseProcessing = mock(async () => true)
    const useCase = new CardReauthorizationUseCase({
      tokenRepository: {
        findForMaster: mock(async () => record()),
        claimForProcessing: mock(async () => ({ kind: "claimed", attemptId: "attempt-1", attemptReference: "asaas-card-attempt:attempt-1" })),
        releaseProcessing,
        markUsed: mock(async () => undefined),
        completeAttempt,
      } as any,
      migrationUseCase: { execute: mock(async () => ({ isValid: false, errorMessages: ["Timeout"], result: { reason: "unknown" } })) } as any,
      migrationGateway: { tokenizeCard: mock(async () => ({ token: "asaas-token" })) } as any,
    })

    await useCase.submit({
      token: "token",
      supabaseId: "master",
      card: { holderName: "Cliente", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      cardholder: { name: "Cliente", email: "cliente@example.com", cpfCnpj: "12345678901", postalCode: "01001000", addressNumber: "1" },
      remoteIp: "203.0.113.10",
    })

    expect(completeAttempt).toHaveBeenCalledWith(expect.objectContaining({ status: "unknown", failureCode: "REMOTE_OUTCOME_UNKNOWN" }))
    expect(releaseProcessing).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, mock } from "bun:test"
import { RequestCardReauthorizationUseCase } from "./RequestCardReauthorizationUseCase"

describe("RequestCardReauthorizationUseCase", () => {
  it("não tenta repetir a transição quando a migração já aguarda cartão", async () => {
    const transition = mock(async () => {
      throw new Error("transição não deveria ser chamada")
    })
    const send = mock(async () => undefined)
    const useCase = new RequestCardReauthorizationUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => ({
          id: "migration-1",
          legacyCustomerId: "cus-legacy",
          primaryCustomerId: "cus-primary",
          status: "requires_card_reauth",
          clientEmail: "cliente@example.com",
          clientName: "Cliente",
          reauthorizationRequestedAt: null,
        })),
        transition,
        findActiveMasterContact: mock(async () => ({ email: "master@example.com", name: "Master Atual" })),
      } as any,
      tokenRepository: { createToken: mock(async () => "token") } as any,
      notifier: { send },
      publicAppUrl: "https://app.example.com",
    })

    const result = await useCase.execute("cus-legacy")

    expect(result.isValid).toBe(true)
    expect(transition).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "master@example.com", name: "Master Atual" }))
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ to: "cliente@example.com" }))
  })
})

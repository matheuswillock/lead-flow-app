import { describe, expect, it, mock } from "bun:test"
import { MigrateAsaasAccountUseCase } from "./MigrateAsaasAccountUseCase"

function migration(status: any = "awaiting_due_date") {
  return {
    id: "migration-1",
    profileId: "profile-1",
    clientName: "Cliente",
    clientEmail: "cliente@example.com",
    legacyCustomerId: "cus_legacy",
    legacySubscriptionId: "sub_legacy",
    primaryCustomerId: "cus_primary",
    primarySubscriptionId: null,
    primaryPaymentId: null,
    billingType: "CREDIT_CARD",
    cycle: "monthly",
    value: 59.9,
    nextDueDate: new Date("2026-10-10T00:00:00.000Z"),
    notificationsDisabled: true,
    anomalyNotes: null,
    status,
    attemptCount: 0,
    lastError: null,
    migratedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    quoteSnapshot: null,
    quoteHash: null,
    legacyRemovedAt: null,
    reauthorizationRequestedAt: null,
    reauthorizationCompletedAt: null,
    resumeStatus: null,
    failureStep: null,
    failureCode: null,
    leaseOwner: null,
    leaseExpiresAt: null,
  } as any
}

const quote = {
  billingOwnerId: "profile-1",
  billingCycle: "monthly" as const,
  products: [],
  billableActiveMembers: 2,
  additionalTeams: 0,
  adjustments: [],
  recurringAmount: 79.8,
  currentAsaasAmount: 59.9,
  status: "aligned" as const,
  blockingReasons: [],
}

describe("MigrateAsaasAccountUseCase", () => {
  it("remove o legado antes de cobrar na conta primary", async () => {
    const calls: string[] = []
    let current = migration()
    const ledgerRepository = {
      findByLegacyCustomerId: mock(async () => current),
      transition: mock(async (input: any) => {
        current = { ...current, ...input, status: input.toStatus }
        return current
      }),
    }
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: ledgerRepository as any,
      customerGateway: { createCustomer: mock(async () => ({ id: "cus_primary" })) } as any,
      migrationGateway: {
        removeLegacySubscription: mock(async () => {
          calls.push("remove")
          return { deleted: true }
        }),
        createImmediatePayment: mock(async () => {
          calls.push("payment")
          return { id: "pay_1", status: "CONFIRMED", value: 79.8, customer: "cus_primary" }
        }),
        createSubscription: mock(async () => {
          calls.push("subscription")
          return { id: "sub_primary", customer: "cus_primary", value: 79.8, cycle: "MONTHLY", nextDueDate: "2026-11-10", status: "ACTIVE" }
        }),
      } as any,
      pointerRepository: { migrateSubscriptionPointers: mock(async () => calls.push("pointers")) } as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      now: new Date("2026-10-10T12:00:00.000Z"),
      creditCardToken: "token-primary",
      remoteIp: "203.0.113.10",
    })

    expect(result.isValid).toBe(true)
    expect(calls).toEqual(["remove", "payment", "subscription", "pointers"])
  })

  it("não remove o legado antes do vencimento", async () => {
    const removeLegacySubscription = mock(async () => ({ deleted: true }))
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => migration()),
        transition: mock(async (input: any) => ({ ...migration(input.toStatus), status: input.toStatus })),
      } as any,
      customerGateway: { createCustomer: mock(async () => ({ id: "cus_primary" })) } as any,
      migrationGateway: { removeLegacySubscription } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      now: new Date("2026-10-09T02:00:00.000Z"),
    })

    expect(result.isValid).toBe(true)
    expect(removeLegacySubscription).not.toHaveBeenCalled()
  })

  it("bloqueia quando quote está blocked", async () => {
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: { findByLegacyCustomerId: mock(async () => migration()) } as any,
      customerGateway: {} as any,
      migrationGateway: {} as any,
      pointerRepository: {} as any,
    })
    const result = await useCase.execute({ legacyCustomerId: "cus_legacy", quote: { ...quote, status: "blocked" } })
    expect(result.isValid).toBe(false)
    expect(result.errorMessages[0]).toContain("Quote bloqueado")
  })

  it("não considera D-1 à noite em São Paulo como vencimento", async () => {
    const removeLegacySubscription = mock(async () => ({ deleted: true }))
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => migration()),
        transition: mock(async (input: any) => ({ ...migration(input.toStatus), status: input.toStatus })),
      } as any,
      customerGateway: {} as any,
      migrationGateway: { removeLegacySubscription } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      now: new Date("2026-10-10T01:00:00.000Z"),
    })

    expect(result.isValid).toBe(true)
    expect(removeLegacySubscription).not.toHaveBeenCalled()
  })

  it("em D-7 solicita cartão sem tocar a assinatura legada", async () => {
    let current = migration("awaiting_due_date")
    const removeLegacySubscription = mock(async () => ({ deleted: true }))
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => current),
        transition: mock(async (input: any) => {
          current = { ...current, ...input, status: input.toStatus }
          return current
        }),
      } as any,
      customerGateway: {} as any,
      migrationGateway: { removeLegacySubscription } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      now: new Date("2026-10-03T15:00:00.000Z"),
    })

    expect(result.isValid).toBe(true)
    expect((result.result as any).status).toBe("requires_card_reauth")
    expect(removeLegacySubscription).not.toHaveBeenCalled()
  })

  it("em D0 sem cartão cancela cobranças pagáveis, inativa o legado e pausa", async () => {
    let current = migration("requires_card_reauth")
    const cancelLegacyPayment = mock(async () => true)
    const payments = [
      [{ id: "pay-pending", status: "PENDING" }],
      [],
    ]
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => current),
        transition: mock(async (input: any) => {
          current = { ...current, ...input, status: input.toStatus }
          return current
        }),
      } as any,
      customerGateway: {} as any,
      migrationGateway: {
        listLegacySubscriptionPayments: mock(async () => payments.shift() ?? []),
        cancelLegacyPayment,
        findLegacySubscription: mock()
          .mockResolvedValueOnce({ id: "sub_legacy", status: "ACTIVE" })
          .mockResolvedValueOnce({ id: "sub_legacy", status: "INACTIVE" }),
        inactivateLegacySubscription: mock(async () => ({ id: "sub_legacy", status: "INACTIVE" })),
        removeLegacySubscription: mock(async () => ({ deleted: true })),
      } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      now: new Date("2026-10-10T15:00:00.000Z"),
    })

    expect(result.isValid).toBe(true)
    expect((result.result as any).status).toBe("paused_awaiting_card")
    expect(cancelLegacyPayment).toHaveBeenCalledWith("pay-pending")
  })

  it("não reporta migração failed como concluída", async () => {
    const failedMigration = migration("failed")
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => failedMigration),
      } as any,
      customerGateway: {} as any,
      migrationGateway: {} as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({ legacyCustomerId: "cus_legacy", quote })

    expect(result.isValid).toBe(false)
    expect(result.errorMessages[0]).toContain("checkpoint")
  })

  it("retoma uma falha a partir do checkpoint persistido", async () => {
    const calls: string[] = []
    let current = migration("failed")
    current.resumeStatus = "awaiting_due_date"
    current.failureCode = "TRANSIENT:timeout"
    const ledgerRepository = {
      findByLegacyCustomerId: mock(async () => current),
      transition: mock(async (input: any) => {
        current = { ...current, ...input, status: input.toStatus }
        return current
      }),
      resumeFailedExecution: mock(async () => {
        current = { ...current, status: "awaiting_due_date" }
        return current
      }),
    }
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: ledgerRepository as any,
      customerGateway: {} as any,
      migrationGateway: {
        removeLegacySubscription: mock(async () => {
          calls.push("remove")
          return { deleted: true }
        }),
      } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      now: new Date("2026-10-10T12:00:00.000Z"),
    })

    expect(result.isValid).toBe(true)
    expect(calls).toEqual(["remove"])
    expect(ledgerRepository.resumeFailedExecution).toHaveBeenCalledWith("cus_legacy")
  })

  it("reconcilia pagamento e assinatura existentes antes de repetir POST", async () => {
    let current = migration("legacy_removed")
    const createPayment = mock(async () => ({ id: "duplicate", status: "CONFIRMED", value: 79.8, customer: "cus_primary" }))
    const createSubscription = mock(async () => ({ id: "duplicate-sub", customer: "cus_primary", value: 79.8, cycle: "MONTHLY", nextDueDate: "2026-11-10", status: "ACTIVE" }))
    const ledgerRepository = {
      findByLegacyCustomerId: mock(async () => current),
      transition: mock(async (input: any) => {
        current = { ...current, ...input, status: input.toStatus }
        return current
      }),
    }
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: ledgerRepository as any,
      customerGateway: {} as any,
      migrationGateway: {
        findPaymentByExternalReference: mock(async () => ({ id: "pay_existing", status: "CONFIRMED", value: 79.8, customer: "cus_primary" })),
        findSubscriptionByExternalReference: mock(async () => ({ id: "sub_existing", customer: "cus_primary", value: 79.8, cycle: "MONTHLY", nextDueDate: "2026-11-10", status: "ACTIVE" })),
        createImmediatePayment: createPayment,
        createSubscription,
      } as any,
      pointerRepository: { migrateSubscriptionPointers: mock(async () => undefined) } as any,
    })

    const result = await useCase.execute({ legacyCustomerId: "cus_legacy", quote, creditCardToken: "token", remoteIp: "203.0.113.10", now: new Date("2026-10-10T12:00:00.000Z") })

    expect(result.isValid).toBe(true)
    expect(createPayment).not.toHaveBeenCalled()
    expect(createSubscription).not.toHaveBeenCalled()
  })

  it("reutiliza customer primary encontrado por externalReference", async () => {
    let current = migration("pending")
    const createCustomer = mock(async () => ({ id: "cus_duplicate" }))
    const ledgerRepository = {
      findByLegacyCustomerId: mock(async () => current),
      transition: mock(async (input: any) => {
        current = { ...current, ...input, status: input.toStatus }
        return current
      }),
    }
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: ledgerRepository as any,
      customerGateway: {
        findCustomerByExternalReference: mock(async () => ({ id: "cus_existing" })),
        createCustomer,
      } as any,
      migrationGateway: {} as any,
      pointerRepository: {} as any,
    })

    await useCase.execute({ legacyCustomerId: "cus_legacy", quote, now: new Date("2026-10-09T02:00:00.000Z") })

    expect(createCustomer).not.toHaveBeenCalled()
    expect(ledgerRepository.transition).toHaveBeenCalledWith(expect.objectContaining({ primaryCustomerId: "cus_existing" }))
  })

  it("ancora o próximo vencimento na data original do legado", async () => {
    let current = migration("initial_payment_confirmed")
    const createSubscription = mock(async (input: any) => ({ id: "sub_primary", customer: "cus_primary", value: input.value, cycle: input.cycle, nextDueDate: input.nextDueDate, status: "ACTIVE" }))
    const ledgerRepository = {
      findByLegacyCustomerId: mock(async () => current),
      transition: mock(async (input: any) => {
        current = { ...current, ...input, status: input.toStatus }
        return current
      }),
    }
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: ledgerRepository as any,
      customerGateway: {} as any,
      migrationGateway: { createSubscription } as any,
      pointerRepository: { migrateSubscriptionPointers: mock(async () => undefined) } as any,
    })

    await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      creditCardToken: "token",
      now: new Date("2026-10-15T12:00:00.000Z"),
    })

    expect(createSubscription).toHaveBeenCalledWith(expect.objectContaining({ nextDueDate: "2026-11-10" }))
  })

  it("não reutiliza pagamento reconciliado de outro customer ou valor", async () => {
    let current = migration("legacy_removed")
    const createPayment = mock(async () => ({ id: "pay-new", status: "CONFIRMED", value: 79.8, customer: "cus_primary" }))
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => current),
        transition: mock(async (input: any) => { current = { ...current, ...input, status: input.toStatus }; return current }),
      } as any,
      customerGateway: {} as any,
      migrationGateway: {
        findPaymentByExternalReference: mock(async () => ({ id: "pay-other", status: "CONFIRMED", value: 1, customer: "cus-other" })),
        createImmediatePayment: createPayment,
      } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({ legacyCustomerId: "cus_legacy", quote, creditCardToken: "token", remoteIp: "203.0.113.10", now: new Date("2026-10-10T12:00:00.000Z") })

    expect(result.isValid).toBe(false)
    expect(createPayment).not.toHaveBeenCalled()
    expect(result.errorMessages[0]).toContain("divergente")
    expect(result.result).toEqual({ reason: "manual_review" })
  })

  it("propaga o externalReference remoto e discrimina uma recusa do pagamento", async () => {
    let current = migration("paused_awaiting_card")
    const findPayment = mock(async () => null)
    const createPayment = mock(async () => ({
      id: "pay-declined",
      status: "DECLINED",
      value: 79.8,
      customer: "cus_primary",
    }))
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => current),
        transition: mock(async (input: any) => {
          current = { ...current, ...input, status: input.toStatus }
          return current
        }),
      } as any,
      customerGateway: {} as any,
      migrationGateway: {
        findPaymentByExternalReference: findPayment,
        createImmediatePayment: createPayment,
      } as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      creditCardToken: "token",
      remoteIp: "203.0.113.10",
      paymentExternalReference: "remote-attempt-42",
      now: new Date("2026-10-10T12:00:00.000Z"),
    })

    expect(findPayment).toHaveBeenCalledWith("remote-attempt-42")
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: "remote-attempt-42" }),
    )
    expect(result.result).toEqual({ reason: "declined" })
  })

  it("discrimina falha remota desconhecida sem depender da mensagem", async () => {
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => migration("paused_awaiting_card")),
        transition: mock(async () => migration("failed")),
      } as any,
      customerGateway: {} as any,
      migrationGateway: {} as any,
      pointerRepository: {} as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      creditCardToken: "token",
      now: new Date("2026-10-10T12:00:00.000Z"),
    })

    expect(result.result).toEqual({ reason: "unknown" })
  })

  it("rejeita assinatura primary inativa ou com vencimento divergente", async () => {
    let current = migration("initial_payment_confirmed")
    const pointerMigration = mock(async () => undefined)
    const useCase = new MigrateAsaasAccountUseCase({
      ledgerRepository: {
        findByLegacyCustomerId: mock(async () => current),
        transition: mock(async (input: any) => { current = { ...current, ...input, status: input.toStatus }; return current }),
      } as any,
      customerGateway: {} as any,
      migrationGateway: {
        findSubscriptionByExternalReference: mock(async () => ({
          id: "sub-inactive",
          customer: "cus_primary",
          value: 79.8,
          cycle: "MONTHLY",
          nextDueDate: "2026-12-10",
          status: "INACTIVE",
        })),
      } as any,
      pointerRepository: { migrateSubscriptionPointers: pointerMigration } as any,
    })

    const result = await useCase.execute({
      legacyCustomerId: "cus_legacy",
      quote,
      creditCardToken: "token",
      now: new Date("2026-10-15T12:00:00.000Z"),
    })

    expect(result.isValid).toBe(false)
    expect(pointerMigration).not.toHaveBeenCalled()
    expect(result.errorMessages[0]).toContain("divergente")
  })
})

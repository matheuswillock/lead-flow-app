import { describe, expect, it, mock } from "bun:test"
import { InMemoryPaymentChargeRepository } from "@/test/support/in-memory-payment-charge-repository"
import { CHARGE_PURPOSES, type ChargePurpose } from "@/lib/payments/types"
import { ChargeLedger, type RecordChargeInput } from "./ChargeLedger"
import {
  createChargePurposeSettlementHandlers,
  UNIMPLEMENTED_SETTLEMENT_PURPOSES,
} from "./chargePurposeHandlers"
import { PaymentChargeSettlementService } from "./PaymentChargeSettlementService"

const PAID_AT = new Date("2026-10-21T12:00:00.000Z")

function chargeInput(purpose: ChargePurpose, overrides: Partial<RecordChargeInput> = {}): RecordChargeInput {
  return {
    profileId: "profile-1",
    purpose,
    purposeRefId: "ref-1",
    status: "PENDING",
    amountCents: 1000,
    provider: "ABACATE_PAY",
    providerEnvironment: "PRODUCTION",
    providerContext: "primary",
    providerExternalId: "pix_1",
    idempotencyKey: `key-${purpose}`,
    source: "ROUTER",
    ...overrides,
  }
}

async function makeHarness(purpose: ChargePurpose, handlers = createChargePurposeSettlementHandlers()) {
  const charges = new InMemoryPaymentChargeRepository()
  const ledger = new ChargeLedger({ charges, now: () => PAID_AT, logError: () => undefined })
  await ledger.record(chargeInput(purpose))
  const reportUnsupportedPurpose = mock((_context: Record<string, unknown>) => undefined)
  const service = new PaymentChargeSettlementService({
    charges,
    ledger,
    handlers,
    reportUnsupportedPurpose,
  })
  return { service, charges, reportUnsupportedPurpose }
}

const settleInput = (ownerId = "charge-1") => ({
  ownerType: "PAYMENT_CHARGE",
  ownerId,
  externalId: "pix_1",
  amountInCents: 1000,
  paidAt: PAID_AT,
})

describe("PaymentChargeSettlementService", () => {
  it("finalidade espelho (ADHESION/GRACE/PLATFORM_PURCHASE): liquida como no-op e fecha a cobrança em COMPLETED", async () => {
    for (const purpose of ["ADHESION", "GRACE", "PLATFORM_PURCHASE"] as const) {
      const { service, charges } = await makeHarness(purpose)

      const result = await service.settleConfirmed(settleInput())

      expect(result).toBe("settled")
      expect(charges.charges[0].status).toBe("COMPLETED")
      expect(charges.charges[0].paidAt).toEqual(PAID_AT)
    }
  })

  it("é idempotente: repetir a liquidação não duplica eventos", async () => {
    const { service, charges } = await makeHarness("ADHESION")

    await service.settleConfirmed(settleInput())
    const eventsAfterFirst = charges.events.length
    const again = await service.settleConfirmed(settleInput())

    expect(again).toBe("settled")
    expect(charges.events).toHaveLength(eventsAfterFirst)
  })

  it("finalidade sem handler devolve unsupported, reporta explicitamente e NÃO fecha a cobrança", async () => {
    const { service, charges, reportUnsupportedPurpose } = await makeHarness("CREDITS")

    const result = await service.settleConfirmed(settleInput())

    expect(result).toBe("unsupported")
    expect(reportUnsupportedPurpose).toHaveBeenCalledTimes(1)
    expect(reportUnsupportedPurpose.mock.calls[0][0]).toMatchObject({ purpose: "CREDITS", chargeId: "charge-1" })
    expect(charges.charges[0].status).toBe("PENDING")
  })

  it("falha do handler propaga e deixa a cobrança em CONFIRMED para o reparo repetir", async () => {
    const failing = { ADHESION: { settle: async () => { throw new Error("efeito falhou") } } }
    const { service, charges } = await makeHarness("ADHESION", failing)

    await expect(service.settleConfirmed(settleInput())).rejects.toThrow("efeito falhou")
    expect(charges.charges[0].status).toBe("CONFIRMED")
  })

  it("cobrança inexistente lança (não engole)", async () => {
    const { service } = await makeHarness("ADHESION")

    await expect(service.settleConfirmed(settleInput("nope"))).rejects.toThrow("Cobrança não encontrada")
  })

  it("ownerType diferente de PAYMENT_CHARGE é unsupported", async () => {
    const { service } = await makeHarness("ADHESION")

    expect(await service.settleConfirmed({ ...settleInput(), ownerType: "OUTRO" })).toBe("unsupported")
  })
})

describe("registro de handlers por finalidade", () => {
  it("toda finalidade está registrada OU explicitamente marcada como não implementada (nunca as duas, nunca nenhuma)", () => {
    const handlers = createChargePurposeSettlementHandlers()
    for (const purpose of CHARGE_PURPOSES) {
      const registered = purpose in handlers
      const unimplemented = UNIMPLEMENTED_SETTLEMENT_PURPOSES.includes(purpose)
      expect(registered !== unimplemented).toBe(true)
    }
  })

  it("SUBSCRIPTION_RENEWAL, ADD_*, CREDITS, CHANGE_ORDER e BACKOFFICE_CHARGE ficam não implementados nesta rodada", () => {
    expect([...UNIMPLEMENTED_SETTLEMENT_PURPOSES].sort()).toEqual(
      ["ADD_TEAM", "ADD_USER", "BACKOFFICE_CHARGE", "CHANGE_ORDER", "CREDITS", "SUBSCRIPTION_RENEWAL"].sort(),
    )
  })
})

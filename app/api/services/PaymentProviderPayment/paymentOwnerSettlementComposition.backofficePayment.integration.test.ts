import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "bun:test"
import { BackofficeClientRepository } from "@/app/api/infra/data/repositories/backoffice/ClientRepository/BackofficeClientRepository"
import { BackofficePaymentRepository } from "@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import { createPaymentOwnerSettlement } from "./paymentOwnerSettlementComposition"

/**
 * A composição liga o settlement de cobrança avulsa ao repositório real. Os testes unitários
 * injetam portas falsas e não enxergam a ligação com a tabela `backoffice_payments`.
 * Roda no banco descartável do stack (`bun run test:compose:integration`); os repositórios não
 * expõem delete, então as linhas ficam nesse banco.
 */
const RUN_INTEGRATION =
  process.env.BACKOFFICE_PAYMENT_SETTLEMENT_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

describe.skipIf(!RUN_INTEGRATION)("createPaymentOwnerSettlement × backoffice_payments", () => {
  const settlement = createPaymentOwnerSettlement()
  const payments = new BackofficePaymentRepository()
  const paidAt = new Date("2026-11-23T12:00:00.000Z")
  let clientId = ""

  beforeAll(async () => {
    const client = await new BackofficeClientRepository().create({
      id: randomUUID(),
      fullName: "Cliente Settlement",
      email: `settlement.${randomUUID()}@example.com`,
    })
    clientId = client.id
  })

  async function createPending(amount: number) {
    const payment = await payments.create({
      id: randomUUID(),
      clientId,
      amount,
      billingType: "PIX",
      status: "PENDING",
      provider: "ABACATE_PAY",
    })
    return payment.id
  }

  const input = (ownerId: string, amountInCents: number | null) => ({
    ownerType: PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_PAYMENT,
    ownerId,
    externalId: "tr_integration",
    amountInCents,
    paidAt,
  })

  async function statusOf(id: string) {
    return (await payments.findById(id))?.status
  }

  it("marca a cobrança como RECEBIDA quando o valor confere e é idempotente", async () => {
    const id = await createPending(199.9)

    expect(await settlement.settleConfirmed(input(id, 19990))).toBe("settled")
    expect(await statusOf(id)).toBe("RECEIVED")

    expect(await settlement.settleConfirmed(input(id, 19990))).toBe("settled")
    expect(await statusOf(id)).toBe("RECEIVED")
  })

  it("rejeita valor divergente sem alterar a cobrança", async () => {
    const id = await createPending(349)

    await expect(settlement.settleConfirmed(input(id, 100))).rejects.toThrow("Valor pago não confere")
    expect(await statusOf(id)).toBe("PENDING")
  })

  it("rejeita pagamento sem valor informado pelo provider", async () => {
    const id = await createPending(89.5)

    await expect(settlement.settleConfirmed(input(id, null))).rejects.toThrow("sem valor informado")
    expect(await statusOf(id)).toBe("PENDING")
  })

  it("rejeita cobrança inexistente", async () => {
    await expect(settlement.settleConfirmed(input(randomUUID(), 100))).rejects.toThrow("não encontrada")
  })
})

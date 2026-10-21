import { prisma } from "@/app/api/infra/data/prisma"
import type {
  AsaasPaymentEventSnapshot,
  IAsaasPaymentEventSourceRepository,
} from "./IAsaasPaymentEventSourceRepository"

type PaymentPayload = { payment?: { id?: unknown; value?: unknown; status?: unknown } } | null

export class AsaasPaymentEventSourceRepository implements IAsaasPaymentEventSourceRepository {
  async findLatestPaymentEvent(input: {
    account: "primary" | "legacy"
    paymentId: string
  }): Promise<AsaasPaymentEventSnapshot | null> {
    const row = await prisma.asaasWebhookEvent.findFirst({
      where: {
        account: input.account,
        payload: { path: ["payment", "id"], equals: input.paymentId },
      },
      orderBy: { receivedAt: "desc" },
      select: { eventType: true, payload: true },
    })
    if (!row) return null
    const payment = (row.payload as PaymentPayload)?.payment
    return {
      valueInReais: typeof payment?.value === "number" ? payment.value : null,
      status: typeof payment?.status === "string" ? payment.status : null,
      event: row.eventType,
    }
  }

  async listPaymentIdsReceivedSince(input: { since: Date; limit: number }) {
    const rows = await prisma.asaasWebhookEvent.findMany({
      where: { receivedAt: { gte: input.since }, eventType: { startsWith: "PAYMENT_" } },
      orderBy: { receivedAt: "desc" },
      take: input.limit,
      select: { account: true, payload: true },
    })
    const seen = new Set<string>()
    const result: Array<{ account: "primary" | "legacy"; paymentId: string }> = []
    for (const row of rows) {
      const id = (row.payload as PaymentPayload)?.payment?.id
      if (typeof id !== "string") continue
      const key = `${row.account}:${id}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ account: row.account, paymentId: id })
    }
    return result
  }
}

export const asaasPaymentEventSourceRepository = new AsaasPaymentEventSourceRepository()

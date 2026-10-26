import { createHmac } from "node:crypto"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import type { PaymentMethod, PaymentAttemptStatus } from "@/lib/payment-provider/types"
import { AbacatePayProvider } from "./AbacatePayProvider"

type FixturePayment = {
  readonly id: string
  readonly method: PaymentMethod
  readonly amountInCents: number
  status: PaymentAttemptStatus
  expiresAt: string
}

const SIGNING_KEY = "dev-mode-signing-key"

/** Deterministic sandbox fixture. It never reads or emits production credentials. */
export function createAbacatePayDevModeFixture(): {
  readonly provider: AbacatePayProvider
  readonly payments: Map<string, FixturePayment>
  readonly confirm: (externalId: string) => void
  readonly expire: (externalId: string) => void
  readonly webhook: (payment: FixturePayment, event: "transparent.completed" | "transparent.refunded") => {
    readonly rawBody: string
    readonly signature: string
  }
} {
  const payments = new Map<string, FixturePayment>()
  let sequence = 0
  const config = PaymentProviderConfig.create({
    apiKey: "sk_dev_fixture",
    publicKey: "pk_dev_fixture",
    webhookSecret: "dev-webhook-secret",
    webhookSigningKey: SIGNING_KEY,
    environment: "DEV",
    devMode: true,
  })

  const http = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    if (url.endsWith("/v2/transparents/create")) {
      const body = JSON.parse(String(init?.body)) as {
        method: PaymentMethod
        data: { amount: number }
      }
      const id = `dev_pay_${++sequence}`
      const payment: FixturePayment = {
        id,
        method: body.method,
        amountInCents: body.data.amount,
        status: "PENDING",
        expiresAt: "2030-01-01T00:00:00Z",
      }
      payments.set(id, payment)
      return json({
        data: {
          id,
          status: payment.status,
          amount: payment.amountInCents,
          ...(payment.method === "PIX"
            ? { brCode: `000201${id}`, brCodeBase64: `base64-${id}`, expiresAt: payment.expiresAt }
            : {}),
        },
      })
    }

    const id = new URL(url).searchParams.get("id") ?? ""
    const payment = payments.get(id)
    if (url.includes("/v2/transparents/check") || url.includes("/v2/transparents/get")) {
      return payment
        ? json({ data: { id: payment.id, status: statusForProvider(payment.status), amount: payment.amountInCents } })
        : json({ success: false, code: "NOT_FOUND" }, 404)
    }

    if (url.endsWith("/v2/transparents/refund")) {
      const refundBody = JSON.parse(String(init?.body)) as { id: string }
      const refundPayment = payments.get(refundBody.id)
      if (!refundPayment) return json({ success: false, code: "NOT_FOUND" }, 404)
      if (refundPayment.status === "REFUNDED") return json({ code: "ALREADY_REFUNDED" }, 409)
      refundPayment.status = "REFUNDED"
      return json({ data: { id: refundPayment.id } })
    }

    return json({ success: false, code: "NOT_FOUND" }, 404)
  }

  const provider = new AbacatePayProvider(config, { http })
  return {
    provider,
    payments,
    confirm: (externalId) => updateStatus(payments, externalId, "CONFIRMED"),
    expire: (externalId) => updateStatus(payments, externalId, "EXPIRED"),
    webhook: (payment, event) => {
      const rawBody = JSON.stringify({
        id: `dev_evt_${payment.id}_${event}`,
        event,
        devMode: true,
        data: { id: payment.id, status: statusForProvider(payment.status), method: payment.method, amount: payment.amountInCents },
      })
      return {
        rawBody,
        signature: createHmac("sha256", SIGNING_KEY).update(rawBody).digest("base64"),
      }
    },
  }
}

function updateStatus(payments: Map<string, FixturePayment>, externalId: string, status: PaymentAttemptStatus): void {
  const payment = payments.get(externalId)
  if (!payment) throw new Error("Pagamento de fixture não encontrado")
  payment.status = status
}

function statusForProvider(status: PaymentAttemptStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "PAID"
    case "REFUNDED":
      return "REFUNDED"
    case "EXPIRED":
      return "EXPIRED"
    default:
      return "PENDING"
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

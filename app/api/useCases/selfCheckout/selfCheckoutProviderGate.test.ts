import { describe, expect, it } from "bun:test"
import { PaymentProviderRegistry } from "@/lib/payment-provider/registry"
import { PaymentProviderRouter } from "@/lib/payment-provider/router"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"
import { SelfCheckoutError } from "@/lib/self-checkout/contracts"
import { createSelfCheckoutProviderGate } from "./selfCheckoutProviderGate"

function config(overrides: Partial<ProviderRoutingConfigRecord> = {}): ProviderRoutingConfigRecord {
  return {
    provider: "ABACATE_PAY",
    environment: "DEV",
    enabled: true,
    isDefault: true,
    rolloutState: "ACTIVE",
    killSwitch: false,
    cardEnabled: false,
    externalAccountContext: "store-1",
    revision: 1,
    healthStatus: "HEALTHY",
    ...overrides,
  }
}

function gateFor(configurations: ProviderRoutingConfigRecord[]) {
  const router = new PaymentProviderRouter(
    { list: async () => configurations },
    new PaymentProviderRegistry([
      {
        metadata: { key: "ABACATE_PAY", environment: "DEV", capabilities: ["ONE_TIME_PAYMENT", "PIX"] },
      },
    ]),
  )
  return createSelfCheckoutProviderGate({
    select: () => router.select({ environment: "DEV", requiredCapabilities: ["ONE_TIME_PAYMENT", "PIX"] }),
  })
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

describe("createSelfCheckoutProviderGate", () => {
  it("provider ativo, saudável e sem kill switch: passa", async () => {
    expect(await rejection(gateFor([config()]).assertAvailable())).toBeNull()
  })

  it.each([
    ["kill switch", { killSwitch: true }],
    ["desabilitado", { enabled: false }],
    ["rollout fora de ACTIVE", { rolloutState: "APPROVED" as const }],
    ["não saudável", { healthStatus: "UNHEALTHY" as const }],
    ["saúde desconhecida", { healthStatus: "UNKNOWN" as const }],
  ])("provider com %s: PROVIDER_UNAVAILABLE (503)", async (_label, overrides) => {
    const error = await rejection(gateFor([config(overrides)]).assertAvailable())

    expect(error).toBeInstanceOf(SelfCheckoutError)
    expect((error as SelfCheckoutError).code).toBe("PROVIDER_UNAVAILABLE")
    expect((error as SelfCheckoutError).status).toBe(503)
    expect((error as SelfCheckoutError).message).toBe(
      "O pagamento está temporariamente indisponível. Tente novamente em instantes.",
    )
  })

  it("sem configuração: PROVIDER_UNAVAILABLE", async () => {
    const error = await rejection(gateFor([]).assertAvailable())

    expect((error as SelfCheckoutError).code).toBe("PROVIDER_UNAVAILABLE")
  })

  it("falha ao resolver o provider (credenciais ausentes) também fecha o checkout", async () => {
    const gate = createSelfCheckoutProviderGate({
      select: async () => {
        throw new Error("Segredo API_KEY do provider não configurado")
      },
    })

    const error = await rejection(gate.assertAvailable())

    expect((error as SelfCheckoutError).code).toBe("PROVIDER_UNAVAILABLE")
  })
})

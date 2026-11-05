import { describe, expect, it } from "bun:test"
import { PaymentProviderRouter } from "./router"
import { PaymentProviderRegistry } from "./registry"
import type { ProviderRoutingConfigRecord } from "./routing-config"

const config: ProviderRoutingConfigRecord = {
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  enabled: true,
  isDefault: true,
  externalAccountContext: "abacate-production",
  rolloutState: "ACTIVE",
  killSwitch: false,
  cardEnabled: false,
  revision: 2,
  healthStatus: "HEALTHY",
}

describe("payment provider router", () => {
  it("combina configuração persistida com capabilities do registry", async () => {
    const router = new PaymentProviderRouter(
      { list: async () => [config] },
      new PaymentProviderRegistry([
        {
          metadata: {
            key: "ABACATE_PAY",
            environment: "PRODUCTION",
            capabilities: ["PIX"],
          },
        },
      ]),
    )

    await expect(
      router.select({ environment: "PRODUCTION", requiredCapabilities: ["PIX"] }),
    ).resolves.toMatchObject({ provider: "ABACATE_PAY", revision: 2 })
  })

  it("não usa Asaas Legacy como fallback quando o default está indisponível", async () => {
    const router = new PaymentProviderRouter(
      {
        list: async () => [
          { ...config, killSwitch: true },
          { ...config, provider: "ASAAS", isDefault: false, externalAccountContext: "primary" },
        ],
      },
      new PaymentProviderRegistry([
        { metadata: { key: "ABACATE_PAY", environment: "PRODUCTION", capabilities: ["PIX"] } },
        { metadata: { key: "ASAAS", environment: "PRODUCTION", capabilities: ["PIX"] } },
      ]),
    )

    await expect(
      router.select({ environment: "PRODUCTION", requiredCapabilities: ["PIX"] }),
    ).rejects.toThrow("padrão")
  })
})

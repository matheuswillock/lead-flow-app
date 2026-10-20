import { describe, expect, it } from "bun:test"
import {
  ProviderRoutingError,
  selectProviderForNewPayment,
  type ProviderRoutingConfig,
} from "./routing"

const baseConfig: ProviderRoutingConfig = {
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  enabled: true,
  isDefault: false,
  rolloutState: "ACTIVE",
  killSwitch: false,
  externalAccountContext: "abacate-production",
  revision: 1,
  healthStatus: "HEALTHY",
}

const providerMetadata = [
  {
    key: "ABACATE_PAY" as const,
    environment: "PRODUCTION" as const,
    capabilities: ["PIX", "CARD", "STATUS_QUERY"] as const,
  },
  {
    key: "ASAAS" as const,
    environment: "PRODUCTION" as const,
    capabilities: ["PIX"] as const,
  },
]

function config(overrides: Partial<ProviderRoutingConfig> = {}): ProviderRoutingConfig {
  return { ...baseConfig, ...overrides }
}

describe("selectProviderForNewPayment", () => {
  it("bloqueia quando nenhum provider está elegível", () => {
    expect(() =>
      selectProviderForNewPayment({
        environment: "PRODUCTION",
        requiredCapabilities: ["PIX"],
        configurations: [config({ enabled: false })],
        providerMetadata,
      }),
    ).toThrowError(new ProviderRoutingError("PROVIDER_NOT_AVAILABLE", "Nenhum provider elegível"))
  })

  it("usa o único provider elegível mesmo sem default", () => {
    const selected = selectProviderForNewPayment({
      environment: "PRODUCTION",
      requiredCapabilities: ["PIX"],
      configurations: [config()],
      providerMetadata,
    })

    expect(selected).toMatchObject({
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      externalAccountContext: "abacate-production",
      revision: 1,
    })
  })

  it("usa o default quando há mais de um provider elegível", () => {
    const selected = selectProviderForNewPayment({
      environment: "PRODUCTION",
      requiredCapabilities: ["PIX"],
      configurations: [
        config({ provider: "ABACATE_PAY", isDefault: true }),
        config({
          provider: "ASAAS",
          externalAccountContext: "primary",
        }),
      ],
      providerMetadata,
    })

    expect(selected.provider).toBe("ABACATE_PAY")
  })

  it("bloqueia quando o default configurado não é elegível, sem fallback", () => {
    expect(() =>
      selectProviderForNewPayment({
        environment: "PRODUCTION",
        requiredCapabilities: ["PIX"],
        configurations: [
          config({ provider: "ABACATE_PAY", isDefault: true, killSwitch: true }),
          config({ provider: "ASAAS" }),
        ],
        providerMetadata,
      }),
    ).toThrowError(
      new ProviderRoutingError("PROVIDER_DEFAULT_INVALID", "O provider padrão não é elegível"),
    )
  })

  it("exige default quando há múltiplos providers elegíveis", () => {
    expect(() =>
      selectProviderForNewPayment({
        environment: "PRODUCTION",
        requiredCapabilities: ["PIX"],
        configurations: [config({ provider: "ABACATE_PAY" }), config({ provider: "ASAAS" })],
        providerMetadata,
      }),
    ).toThrowError(
      new ProviderRoutingError(
        "PROVIDER_DEFAULT_REQUIRED",
        "É necessário configurar um provider padrão",
      ),
    )
  })

  it("ignora configurações de outro ambiente e rollout ainda não ativo", () => {
    expect(() =>
      selectProviderForNewPayment({
        environment: "PRODUCTION",
        requiredCapabilities: ["PIX"],
        configurations: [config({ environment: "DEV" }), config({ rolloutState: "APPROVED" })],
        providerMetadata,
      }),
    ).toThrow("Nenhum provider elegível")
  })

  it("não permite escolher capability ausente no adapter", () => {
    expect(() =>
      selectProviderForNewPayment({
        environment: "PRODUCTION",
        requiredCapabilities: ["CARD"],
        configurations: [config()],
        providerMetadata: [providerMetadata[1]],
      }),
    ).toThrow("Nenhum provider elegível")
  })

  it("falha fechado quando a saúde do provider é desconhecida", () => {
    expect(() =>
      selectProviderForNewPayment({
        environment: "PRODUCTION",
        requiredCapabilities: ["PIX"],
        configurations: [config({ healthStatus: "UNKNOWN" })],
        providerMetadata,
      }),
    ).toThrow("Nenhum provider elegível")
  })
})

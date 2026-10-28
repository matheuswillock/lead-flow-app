import { describe, expect, it } from "bun:test"
import { ApiRequestError } from "@/lib/http/api-request-error"
import { runCardToggle } from "./cardConfigToggle"
import type {
  AbacateCardConfig,
  CardConfigEnvironment,
  ICardConfigService,
} from "./ICardConfigService"

function config(overrides: Partial<AbacateCardConfig> = {}): AbacateCardConfig {
  return { environment: "PRODUCTION", cardEnabled: false, revision: 3, ...overrides }
}

function fakeService(overrides: Partial<ICardConfigService> = {}): ICardConfigService {
  return {
    getAbacateCardConfig: async () => config(),
    setCardEnabled: async (environment: CardConfigEnvironment, cardEnabled, expectedRevision) =>
      config({ environment, cardEnabled, revision: expectedRevision + 1 }),
    ...overrides,
  }
}

describe("runCardToggle", () => {
  it("devolve o registro salvo com a revisão nova", async () => {
    const outcome = await runCardToggle(fakeService(), "PRODUCTION", true, 3)
    expect(outcome).toEqual({
      status: "saved",
      config: { environment: "PRODUCTION", cardEnabled: true, revision: 4 },
    })
  })

  it("envia a revisão esperada para o service", async () => {
    const received: number[] = []
    const service = fakeService({
      setCardEnabled: async (environment, cardEnabled, expectedRevision) => {
        received.push(expectedRevision)
        return config({ environment, cardEnabled })
      },
    })
    await runCardToggle(service, "DEV", false, 9)
    expect(received).toEqual([9])
  })

  it("em 409 recarrega o registro e devolve conflito com a revisão atual", async () => {
    const service = fakeService({
      setCardEnabled: async () => {
        throw new ApiRequestError("A revisão da configuração está desatualizada", 409)
      },
      getAbacateCardConfig: async () => config({ cardEnabled: true, revision: 8 }),
    })
    const outcome = await runCardToggle(service, "PRODUCTION", true, 3)
    expect(outcome).toEqual({
      status: "conflict",
      config: { environment: "PRODUCTION", cardEnabled: true, revision: 8 },
    })
  })

  it("em 409 com a recarga falhando ainda devolve conflito, sem registro", async () => {
    const service = fakeService({
      setCardEnabled: async () => {
        throw new ApiRequestError("desatualizada", 409)
      },
      getAbacateCardConfig: async () => {
        throw new Error("rede")
      },
    })
    expect(await runCardToggle(service, "DEV", true, 1)).toEqual({ status: "conflict", config: null })
  })

  it("em 403 devolve sem permissão", async () => {
    const service = fakeService({
      setCardEnabled: async () => {
        throw new ApiRequestError("Operators não têm permissão para realizar esta ação", 403)
      },
    })
    expect(await runCardToggle(service, "DEV", true, 1)).toEqual({ status: "forbidden" })
  })

  it("erro de API traz a mensagem do servidor", async () => {
    const service = fakeService({
      setCardEnabled: async () => {
        throw new ApiRequestError("Payload de configuração inválido", 400)
      },
    })
    expect(await runCardToggle(service, "DEV", true, 1)).toEqual({
      status: "error",
      message: "Payload de configuração inválido",
    })
  })

  it("erro desconhecido vira mensagem genérica em português", async () => {
    const service = fakeService({
      setCardEnabled: async () => {
        throw new TypeError("Failed to fetch")
      },
    })
    expect(await runCardToggle(service, "DEV", true, 1)).toEqual({
      status: "error",
      message: "Não foi possível salvar a configuração de cartão.",
    })
  })
})

import { beforeEach, describe, expect, it } from "bun:test"
import type { IPublicFormShareBaseUrlClientService } from "./IPublicFormShareBaseUrlClientService"
import {
  clearPublicFormShareBaseUrlCache,
  resolvePublicFormShareBaseUrl,
} from "./usePublicFormShareBaseUrl"

const TEAM_A = "team-a"
const TEAM_B = "team-b"

/**
 * Serviço de teste que devolve um domínio diferente a cada chamada, na ordem
 * da fila. Conta chamadas para medir dedupe.
 */
function makeService(responses: Array<string | null>) {
  const calls: number[] = []
  let index = 0
  const service: IPublicFormShareBaseUrlClientService = {
    async getFormDomain() {
      const baseUrl = responses[Math.min(index, responses.length - 1)]
      return { hostname: baseUrl ? new URL(baseUrl).hostname : null, isVerified: Boolean(baseUrl) }
    },
    async getVerifiedFormDomainBaseUrl() {
      calls.push(index)
      const value = responses[Math.min(index, responses.length - 1)]
      index += 1
      return value
    },
  }
  return { service, callCount: () => calls.length }
}

describe("resolvePublicFormShareBaseUrl", () => {
  beforeEach(() => {
    clearPublicFormShareBaseUrlCache()
  })

  it("não vaza o domínio do time A para o time B dentro do TTL", async () => {
    const { service } = makeService(["https://forms.time-a.com.br", "https://forms.time-b.com.br"])

    const a = await resolvePublicFormShareBaseUrl(service, TEAM_A)
    const b = await resolvePublicFormShareBaseUrl(service, TEAM_B)

    expect(a).toBe("https://forms.time-a.com.br")
    expect(b).toBe("https://forms.time-b.com.br")
  })

  it("volta ao valor do time A ao retornar para ele, sem nova chamada", async () => {
    const { service, callCount } = makeService([
      "https://forms.time-a.com.br",
      "https://forms.time-b.com.br",
    ])

    await resolvePublicFormShareBaseUrl(service, TEAM_A)
    await resolvePublicFormShareBaseUrl(service, TEAM_B)
    const backToA = await resolvePublicFormShareBaseUrl(service, TEAM_A)

    expect(backToA).toBe("https://forms.time-a.com.br")
    expect(callCount()).toBe(2)
  })

  it("deduplica chamadas concorrentes do mesmo time", async () => {
    const { service, callCount } = makeService(["https://forms.time-a.com.br"])

    const [first, second] = await Promise.all([
      resolvePublicFormShareBaseUrl(service, TEAM_A),
      resolvePublicFormShareBaseUrl(service, TEAM_A),
    ])

    expect(first).toBe("https://forms.time-a.com.br")
    expect(second).toBe("https://forms.time-a.com.br")
    expect(callCount()).toBe(1)
  })

  it("não deduplica times diferentes numa mesma rodada", async () => {
    const { service, callCount } = makeService([
      "https://forms.time-a.com.br",
      "https://forms.time-b.com.br",
    ])

    const [a, b] = await Promise.all([
      resolvePublicFormShareBaseUrl(service, TEAM_A),
      resolvePublicFormShareBaseUrl(service, TEAM_B),
    ])

    expect(a).toBe("https://forms.time-a.com.br")
    expect(b).toBe("https://forms.time-b.com.br")
    expect(callCount()).toBe(2)
  })

  it("falha de rede devolve null sem travar chamadas seguintes", async () => {
    const service: IPublicFormShareBaseUrlClientService = {
      async getFormDomain() {
        return { hostname: null, isVerified: false }
      },
      async getVerifiedFormDomainBaseUrl() {
        throw new Error("network down")
      },
    }

    expect(await resolvePublicFormShareBaseUrl(service, TEAM_A)).toBeNull()
  })
})

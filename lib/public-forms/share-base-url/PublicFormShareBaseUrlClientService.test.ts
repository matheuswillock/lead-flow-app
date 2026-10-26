import { afterEach, describe, expect, it } from "bun:test"
import { PublicFormShareBaseUrlClientService } from "./PublicFormShareBaseUrlClientService"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("PublicFormShareBaseUrlClientService", () => {
  it("retorna o subdomínio verificado para a interface de publicação", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          isValid: true,
          result: { formDomain: { hostname: "forms.time.com.br", status: "verified" } },
        }),
        { status: 200 },
      )) as unknown as typeof fetch

    const service = new PublicFormShareBaseUrlClientService()

    await expect(service.getFormDomain()).resolves.toEqual({
      hostname: "forms.time.com.br",
      isVerified: true,
    })
    await expect(service.getVerifiedFormDomainBaseUrl()).resolves.toBe("https://forms.time.com.br")
  })

  it("mantém a publicação bloqueada quando o domínio está pendente", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          isValid: true,
          result: { formDomain: { hostname: "forms.time.com.br", status: "pending" } },
        }),
        { status: 200 },
      )) as unknown as typeof fetch

    const service = new PublicFormShareBaseUrlClientService()

    await expect(service.getFormDomain()).resolves.toEqual({
      hostname: "forms.time.com.br",
      isVerified: false,
    })
    await expect(service.getVerifiedFormDomainBaseUrl()).resolves.toBeNull()
  })
})

import { afterEach, describe, expect, it, mock } from "bun:test"

/**
 * T-21.1 (DA1): `!response.ok` NUNCA pode virar "HTTP error! status: N" cru
 * no `Error.message` — o body do backend (`errorMessages` PT-BR) precisa ser
 * lido e propagado. Body ilegível (502/504 de proxy) cai no fallback fixo,
 * também nunca no status cru.
 */
describe("SubscriptionService — propagação de errorMessages do body (DA1)", () => {
  afterEach(() => {
    mock.restore()
  })

  it("404 de negócio com errorMessages no body → Error carrega a mensagem PT-BR do backend", async () => {
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          isValid: false,
          errorMessages: ["Assinatura não encontrada para esta conta"],
          result: null,
        }),
        { status: 404 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { SubscriptionService } = await import("./SubscriptionService")
    const service = new SubscriptionService()

    await expect(service.getSubscription("supabase-1")).rejects.toThrow(
      "Assinatura não encontrada para esta conta"
    )
  })

  it("body ilegível (proxy 502 devolvendo HTML) → mensagem padrão, nunca 'HTTP error! status: 502' cru", async () => {
    const fetchMock = mock(async () => new Response("<html>Bad Gateway</html>", { status: 502 }))
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { SubscriptionService } = await import("./SubscriptionService")
    const service = new SubscriptionService()

    try {
      await service.getSubscription("supabase-1")
      throw new Error("deveria ter lançado")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).not.toContain("HTTP error! status")
      expect(message).toBe("Erro ao carregar assinatura.")
    }
  })

  it("cancelSubscription: 403 com errorMessages → mensagem de negócio propagada (mesmo padrão nos 6 métodos)", async () => {
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({ isValid: false, errorMessages: ["Sem permissão para cancelar esta assinatura"] }),
        { status: 403 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { SubscriptionService } = await import("./SubscriptionService")
    const service = new SubscriptionService()

    await expect(service.cancelSubscription("supabase-1")).rejects.toThrow(
      "Sem permissão para cancelar esta assinatura"
    )
  })

  it("getSubscription: resposta 200 com isValid true e result null → retorna null (assinatura inexistente é estado válido, não erro)", async () => {
    const fetchMock = mock(async () =>
      Response.json({ isValid: true, successMessages: [], errorMessages: [], result: null })
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { SubscriptionService } = await import("./SubscriptionService")
    const service = new SubscriptionService()

    await expect(service.getSubscription("supabase-1")).resolves.toBeNull()
  })
})

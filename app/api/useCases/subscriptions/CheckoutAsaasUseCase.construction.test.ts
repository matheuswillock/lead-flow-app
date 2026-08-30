import { describe, expect, it, mock } from "bun:test"

/**
 * E5 de [[10 — Fundações Multi-conta — Backend]] — controle negativo real:
 * o refactor DIP trocou `private readonly x: IX = x` (import de mesmo nome)
 * por `= defaultX` (alias) especificamente porque a primeira forma faz o
 * parâmetro sombrear a própria default e lançar
 * "Cannot access 'x' before initialization" na TDZ — TODO objeto exportado
 * como `export const checkoutAsaasUseCase = new CheckoutAsaasUseCase()`
 * (construção sem argumentos, o caminho real de produção) quebraria no
 * import do módulo. Nenhum teste anterior pegou isso porque nada
 * instanciava a classe sem injetar tudo explicitamente.
 */
mock.module("server-only", () => ({}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => null,
}))

const emailServiceStub = {
  sendWelcomeEmail: async () => {},
  sendOperatorInviteEmail: async () => {},
}

mock.module("@/lib/services/EmailService", () => ({
  EmailService: class {},
  createEmailService: () => emailServiceStub,
  getEmailService: () => emailServiceStub,
  emailService: emailServiceStub,
}))

mock.module("@/lib/asaas", () => ({
  asaasFetch: mock(async () => ({})),
  asaasApi: { customers: "x", checkouts: "x", payments: "x", subscriptions: "x" },
}))

describe("CheckoutAsaasUseCase — construção sem argumentos (E5, controle negativo)", () => {
  it("new CheckoutAsaasUseCase() não lança (defaults resolvem os singletons reais)", async () => {
    const { CheckoutAsaasUseCase } = await import("./CheckoutAsaasUseCase")
    expect(() => new CheckoutAsaasUseCase()).not.toThrow()
  })

  it("o módulo exporta checkoutAsaasUseCase (construção no import) sem lançar", async () => {
    const checkoutModule = await import("./CheckoutAsaasUseCase")
    expect(checkoutModule.checkoutAsaasUseCase).toBeInstanceOf(checkoutModule.CheckoutAsaasUseCase)
  })
})

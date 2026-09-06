import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// T-40.1/T-40.2 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E1/C17):
// os IDs de checkout hospedado de créditos saem do hardcode, sem fallback.

const findByEmailMock = mock(async (_email: string) => ({ id: "profile-1" }) as any)
const notifyMock = mock(async () => ({ success: true }))

mock.module("@/app/api/infra/data/repositories/profile/ProfileRepository", () => ({
  profileRepository: { findByEmail: findByEmailMock },
}))

mock.module("@/app/api/services/slackEmailCredits/SlackEmailCreditsService", () => ({
  slackEmailCreditsService: { notify: notifyMock },
}))

mock.module("@/lib/asaas", () => ({
  getAsaasCheckoutBaseUrl: () => "https://sandbox.asaas.com",
}))

const { ValidarEmailCreditosUseCase } = await import("./ValidarEmailCreditosUseCase")

const ORIGINAL_ENV = { ...process.env }

describe("ValidarEmailCreditosUseCase — checkout hospedado sai do hardcode (E1)", () => {
  beforeEach(() => {
    findByEmailMock.mockClear()
    notifyMock.mockClear()
    delete process.env.ASAAS_CREDIT_CHECKOUT_ID_25K
    delete process.env.ASAAS_CREDIT_CHECKOUT_ID_50K
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("T-40.1: env ausente → Output inválido com mensagem operacional; nenhum ID literal usado como fallback", async () => {
    const useCase = new ValidarEmailCreditosUseCase()

    const output = await useCase.execute({ email: "cliente@example.test", plan: "25k" })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.length).toBeGreaterThan(0)
    // sem fallback: nem o profile foi consultado nem o Slack foi notificado
    expect(findByEmailMock).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it("T-40.2: checkoutUrl monta de getAsaasCheckoutBaseUrl() + /c/ + env; IDs legados não existem em app/**", async () => {
    process.env.ASAAS_CREDIT_CHECKOUT_ID_25K = "cus_env_25k"
    process.env.ASAAS_CREDIT_CHECKOUT_ID_50K = "cus_env_50k"

    const useCase = new ValidarEmailCreditosUseCase()
    const output = await useCase.execute({ email: "cliente@example.test", plan: "25k" })

    expect(output.isValid).toBe(true)
    expect((output.result as { checkoutUrl: string }).checkoutUrl).toBe(
      "https://sandbox.asaas.com/c/cus_env_25k"
    )

    const legacyIds = ["7t6pqaxdfc0yyc65", "g8wl8a5xrn009icv"]
    const appRoot = join(import.meta.dir, "..", "..", "..", "..")
    const offenders: string[] = []

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
          const content = readFileSync(fullPath, "utf-8")
          if (legacyIds.some((id) => content.includes(id))) {
            offenders.push(fullPath)
          }
        }
      }
    }

    walk(join(appRoot, "app"))

    expect(offenders).toEqual([])
  })
})

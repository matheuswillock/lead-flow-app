import { afterEach, describe, expect, it } from "bun:test"
import { resolveAsaasLedgerEnvironment } from "./asaas-ledger-environment"

const original = process.env.ASAAS_ENV
const mutableEnv = process.env as Record<string, string | undefined>
const originalNodeEnv = mutableEnv.NODE_ENV

afterEach(() => {
  if (original === undefined) delete process.env.ASAAS_ENV
  else process.env.ASAAS_ENV = original
  mutableEnv.NODE_ENV = originalNodeEnv
})

describe("resolveAsaasLedgerEnvironment", () => {
  it("ASAAS_ENV ausente em desenvolvimento resolve DEV (mesma regra do cliente Asaas)", () => {
    delete process.env.ASAAS_ENV
    mutableEnv.NODE_ENV = "development"
    expect(resolveAsaasLedgerEnvironment()).toBe("DEV")
  })

  it("ASAAS_ENV ausente em produção resolve PRODUCTION", () => {
    delete process.env.ASAAS_ENV
    mutableEnv.NODE_ENV = "production"
    expect(resolveAsaasLedgerEnvironment()).toBe("PRODUCTION")
  })

  it("ASAAS_ENV explícito vence NODE_ENV", () => {
    mutableEnv.NODE_ENV = "development"
    process.env.ASAAS_ENV = "production"
    expect(resolveAsaasLedgerEnvironment()).toBe("PRODUCTION")
    mutableEnv.NODE_ENV = "production"
    process.env.ASAAS_ENV = "sandbox"
    expect(resolveAsaasLedgerEnvironment()).toBe("DEV")
  })
})

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { assertAsaasSandbox } from "./asaas"

const ENV_KEYS = [
  "ASAAS_ENV",
  "ASAAS_URL",
  "ASAAS_URL_sandbox",
  "ASAAS_BASE_URL",
  "ASAAS_API_KEY",
  "ASAAS_SANDBOX_API_KEY",
  "ASAAS_LEGACY_API_KEY",
  "ASAAS_LEGACY_SANDBOX_API_KEY",
] as const

let snapshot: Record<string, string | undefined> = {}

beforeEach(() => {
  snapshot = {}
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
})

function setValidSandboxBaseline() {
  process.env.ASAAS_ENV = "sandbox"
  process.env.ASAAS_URL_sandbox = "https://sandbox.asaas.com"
  process.env.ASAAS_API_KEY = "aact_hmlg_primary"
  process.env.ASAAS_SANDBOX_API_KEY = "aact_hmlg_primary_sandbox"
}

describe("assertAsaasSandbox — vars legacy (E2/T-10.5)", () => {
  it("baseline sandbox sem legacy segue passando (comportamento pré-existente preservado)", () => {
    setValidSandboxBaseline()
    expect(() => assertAsaasSandbox()).not.toThrow()
  })

  it("lança quando ASAAS_LEGACY_API_KEY existe sem par sandbox", () => {
    setValidSandboxBaseline()
    process.env.ASAAS_LEGACY_API_KEY = "aact_hmlg_legacy_real"

    expect(() => assertAsaasSandbox()).toThrow(/ASAAS_LEGACY_SANDBOX_API_KEY/)
  })

  it("não lança quando ASAAS_LEGACY_API_KEY existe COM par sandbox", () => {
    setValidSandboxBaseline()
    process.env.ASAAS_LEGACY_API_KEY = "aact_hmlg_legacy_real"
    process.env.ASAAS_LEGACY_SANDBOX_API_KEY = "aact_hmlg_legacy_sandbox"

    expect(() => assertAsaasSandbox()).not.toThrow()
  })

  it("lança quando a URL efetiva da conta legacy aponta para host de produção", () => {
    setValidSandboxBaseline()
    process.env.ASAAS_LEGACY_API_KEY = "aact_hmlg_legacy_real"
    process.env.ASAAS_LEGACY_SANDBOX_API_KEY = "aact_hmlg_legacy_sandbox"
    // Simula o cenário perigoso: alguém aponta ASAAS_URL_sandbox (usada pela
    // resolução de conta única — C30) para produção por engano.
    process.env.ASAAS_URL_sandbox = "https://www.asaas.com"

    expect(() => assertAsaasSandbox()).toThrow(/produção/)
  })
})

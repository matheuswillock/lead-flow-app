import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { CredentialReadError } from "@/lib/payment-provider/credential-resolver"
import {
  resetCredentialRuntimeLoader,
  setCredentialRuntimeLoaderForTests,
} from "@/lib/payment-provider/credential-runtime-loader"
import { hydrateAsaasCredentials, hydrateAsaasCredentialsOrEnvFallback } from "./asaas-hydration"

const KEY = "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
let saved: string | undefined

function runtimeThatThrows(error: unknown) {
  setCredentialRuntimeLoaderForTests(async () => ({
    hydrateProviderCredentials: async () => {
      throw error
    },
  }))
}

beforeEach(() => {
  saved = process.env[KEY]
  process.env[KEY] = "m".repeat(64)
})

afterEach(() => {
  if (saved === undefined) delete process.env[KEY]
  else process.env[KEY] = saved
  resetCredentialRuntimeLoader()
})

describe("hydrateAsaasCredentials (estrita: autenticação do webhook)", () => {
  it("banco indisponível sem stale LANÇA CredentialReadError (falha fechada)", async () => {
    runtimeThatThrows(new CredentialReadError(new Error("down")))
    await expect(hydrateAsaasCredentials("primary")).rejects.toBeInstanceOf(CredentialReadError)
  })

  it("sem chave-mestra não toca o runtime", async () => {
    delete process.env[KEY]
    runtimeThatThrows(new Error("não deveria ser chamado"))
    await expect(hydrateAsaasCredentials("primary")).resolves.toBeUndefined()
  })
})

describe("hydrateAsaasCredentialsOrEnvFallback (chamadas de saída)", () => {
  it("banco indisponível sem stale degrada para o ambiente com log sem valores", async () => {
    runtimeThatThrows(new CredentialReadError(new Error("down")))
    const logs: Array<{ event: string; fields: Record<string, unknown> }> = []
    await hydrateAsaasCredentialsOrEnvFallback("primary", (event, fields) => logs.push({ event, fields }))
    expect(logs).toEqual([
      { event: "asaas-credentials-fallback-env", fields: { asaasAccount: "primary", cause: "Error" } },
    ])
  })

  it("outros erros (ex.: credencial ilegível) continuam lançando", async () => {
    runtimeThatThrows(new Error("decrypt failed"))
    await expect(hydrateAsaasCredentialsOrEnvFallback("primary", () => undefined)).rejects.toThrow(
      "decrypt failed",
    )
  })
})

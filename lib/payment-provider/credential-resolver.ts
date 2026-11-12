import { decryptProviderCredential } from "./credential-cipher"

type StoredProviderCredential = {
  readonly keyId: string
  readonly valueCiphertext: string
}

export async function resolveProviderCredential(input: {
  readonly stored: () => Promise<StoredProviderCredential | null>
  readonly fromEnvironment: () => string | undefined
}): Promise<{ readonly value: string; readonly source: "database" | "environment" }> {
  const stored = await input.stored()
  if (stored) {
    return {
      value: decryptProviderCredential(stored.valueCiphertext, stored.keyId),
      source: "database",
    }
  }

  const value = input.fromEnvironment()
  if (!value?.trim()) throw new Error("Credencial obrigatória do provider não configurada")
  return { value, source: "environment" }
}

export async function resolveOptionalProviderCredential(input: {
  readonly stored: () => Promise<StoredProviderCredential | null>
  readonly fromEnvironment: () => string | undefined
}): Promise<{ readonly value: string | null; readonly source: "database" | "environment" | "missing" }> {
  const stored = await input.stored()
  if (stored) {
    return {
      value: decryptProviderCredential(stored.valueCiphertext, stored.keyId),
      source: "database",
    }
  }

  const value = input.fromEnvironment()?.trim()
  return value ? { value, source: "environment" } : { value: null, source: "missing" }
}

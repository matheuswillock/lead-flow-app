import type { ProviderCredentialMeta } from "@/lib/payment-provider/instance"

export type StoredCredential = {
  readonly key: string
  readonly valueCiphertext: string
  readonly keyId: string
}

export type UpsertCredentialInput = {
  readonly configId: string
  readonly key: string
  readonly valueCiphertext: string
  readonly keyId: string
  readonly last4: string | null
  readonly fingerprint: string
  readonly updatedBy: string | null
}

export interface IPaymentProviderCredentialRepository {
  /** Somente metadados: nunca devolve texto cifrado. */
  listMeta(configId: string): Promise<readonly ProviderCredentialMeta[]>
  listMetaByConfigIds(
    configIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ProviderCredentialMeta[]>>
  /** Uso exclusivo do resolver de credenciais (decifra no servidor). */
  listCiphertexts(configId: string): Promise<readonly StoredCredential[]>
  /** Retorna se a chave já existia (criação vs. rotação). */
  upsert(input: UpsertCredentialInput): Promise<{ existed: boolean }>
  delete(configId: string, key: string): Promise<{ deleted: boolean }>
}

import { prisma } from "@/app/api/infra/data/prisma"
import type { ProviderCredentialMeta } from "@/lib/payment-provider/instance"
import type {
  IPaymentProviderCredentialRepository,
  StoredCredential,
  UpsertCredentialInput,
} from "./IPaymentProviderCredentialRepository"

const metaSelect = { configId: true, key: true, last4: true, fingerprint: true, updatedAt: true } as const

export class PaymentProviderCredentialRepository implements IPaymentProviderCredentialRepository {
  async listMeta(configId: string): Promise<readonly ProviderCredentialMeta[]> {
    const rows = await prisma.paymentProviderCredential.findMany({
      where: { configId },
      select: metaSelect,
      orderBy: { key: "asc" },
    })
    return rows.map(toMeta)
  }

  async listMetaByConfigIds(configIds: readonly string[]) {
    const grouped = new Map<string, ProviderCredentialMeta[]>()
    if (configIds.length === 0) return grouped
    const rows = await prisma.paymentProviderCredential.findMany({
      where: { configId: { in: [...configIds] } },
      select: metaSelect,
      orderBy: { key: "asc" },
    })
    for (const row of rows) {
      const list = grouped.get(row.configId) ?? []
      list.push(toMeta(row))
      grouped.set(row.configId, list)
    }
    return grouped
  }

  async listCiphertexts(configId: string): Promise<readonly StoredCredential[]> {
    return prisma.paymentProviderCredential.findMany({
      where: { configId },
      select: { key: true, valueCiphertext: true, keyId: true },
    })
  }

  async upsert(input: UpsertCredentialInput): Promise<{ existed: boolean }> {
    const where = { configId_key: { configId: input.configId, key: input.key } }
    const existing = await prisma.paymentProviderCredential.findUnique({ where, select: { id: true } })
    const data = {
      valueCiphertext: input.valueCiphertext,
      keyId: input.keyId,
      last4: input.last4,
      fingerprint: input.fingerprint,
      updatedBy: input.updatedBy,
    }
    await prisma.paymentProviderCredential.upsert({
      where,
      create: { configId: input.configId, key: input.key, ...data },
      update: data,
      select: { id: true },
    })
    return { existed: existing !== null }
  }

  async delete(configId: string, key: string): Promise<{ deleted: boolean }> {
    const result = await prisma.paymentProviderCredential.deleteMany({ where: { configId, key } })
    return { deleted: result.count > 0 }
  }
}

function toMeta(row: {
  key: string
  last4: string | null
  fingerprint: string
  updatedAt: Date
}): ProviderCredentialMeta {
  return { key: row.key, last4: row.last4, fingerprint: row.fingerprint, updatedAt: row.updatedAt }
}

export const paymentProviderCredentialRepository = new PaymentProviderCredentialRepository()

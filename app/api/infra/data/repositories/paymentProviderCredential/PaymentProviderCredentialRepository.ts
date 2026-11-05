import { createHash } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { encryptProviderCredential } from "@/lib/payment-provider/credential-cipher"
import type {
  CreatePaymentProviderInstanceInput,
  IPaymentProviderCredentialRepository,
  PaymentProviderInstanceRecord,
  UpdatePaymentProviderInstanceInput,
} from "./IPaymentProviderCredentialRepository"

const instanceSelect = {
  id: true,
  providerKey: true,
  environment: true,
  displayName: true,
  externalAccountContext: true,
  enabled: true,
  rolloutState: true,
  isDefault: true,
  healthStatus: true,
  lastHealthCheckAt: true,
  logoUrl: true,
  logoAltText: true,
  credentials: { select: { key: true, last4: true, fingerprint: true } },
} as const

export class PaymentProviderCredentialRepository implements IPaymentProviderCredentialRepository {
  async findById(id: string): Promise<PaymentProviderInstanceRecord | null> {
    const record = await prisma.paymentProviderConfig.findUnique({ where: { id }, select: instanceSelect })
    return record ? toInstanceRecord(record) : null
  }

  async list(environment?: CreatePaymentProviderInstanceInput["environment"]): Promise<readonly PaymentProviderInstanceRecord[]> {
    const records = await prisma.paymentProviderConfig.findMany({
      where: environment ? { environment } : undefined,
      select: instanceSelect,
      orderBy: [{ environment: "asc" }, { providerKey: "asc" }, { displayName: "asc" }],
    })
    return records.map(toInstanceRecord)
  }

  async create(input: CreatePaymentProviderInstanceInput): Promise<PaymentProviderInstanceRecord> {
    const credentialRows = Object.entries(input.credentials)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => {
        const encrypted = encryptProviderCredential(value)
        return {
          key,
          ...encrypted,
          last4: value.slice(-4),
          fingerprint: fingerprint(value),
          updatedByProfileId: input.actorProfileId,
        }
      })

    const created = await prisma.$transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.paymentProviderConfig.updateMany({
          where: { environment: input.environment, isDefault: true },
          data: { isDefault: false, configRevision: { increment: 1 } },
        })
      }
      return transaction.paymentProviderConfig.create({
        data: {
          providerKey: input.provider,
          environment: input.environment,
          displayName: input.displayName,
          externalAccountContext: input.externalAccountContext,
          isDefault: input.isDefault,
          logoUrl: input.logoUrl,
          logoAltText: input.logoAltText,
          credentials: { create: credentialRows },
        },
        select: instanceSelect,
      })
    })
    return toInstanceRecord(created)
  }

  async update(input: UpdatePaymentProviderInstanceInput): Promise<PaymentProviderInstanceRecord> {
    const credentialRows = Object.entries(input.credentials)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => ({
        key,
        ...encryptProviderCredential(value),
        last4: value.slice(-4),
        fingerprint: fingerprint(value),
        updatedByProfileId: input.actorProfileId,
      }))

    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.paymentProviderConfig.findUnique({
        where: { id: input.id },
        select: { id: true, providerKey: true, environment: true },
      })
      if (!current) throw new Error("Instância de provider não encontrada")
      if (input.isDefault) {
        await transaction.paymentProviderConfig.updateMany({
          where: { environment: current.environment, isDefault: true, id: { not: current.id } },
          data: { isDefault: false, configRevision: { increment: 1 } },
        })
      }
      await transaction.paymentProviderConfig.update({
        where: { id: current.id },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
          ...(input.logoAltText !== undefined ? { logoAltText: input.logoAltText } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          configRevision: { increment: 1 },
        },
      })
      const nextWebhookSecret = input.credentials.WEBHOOK_SECRET?.trim()
      if (current.providerKey === "ABACATE_PAY" && nextWebhookSecret) {
        const currentSecret = await transaction.paymentProviderCredential.findUnique({
          where: { configId_key: { configId: current.id, key: "WEBHOOK_SECRET" } },
          select: { valueCiphertext: true, keyId: true, last4: true, fingerprint: true },
        })
        if (currentSecret) {
          await transaction.paymentProviderCredential.upsert({
            where: { configId_key: { configId: current.id, key: "WEBHOOK_SECRET_PREVIOUS" } },
            create: {
              configId: current.id,
              key: "WEBHOOK_SECRET_PREVIOUS",
              ...currentSecret,
              updatedByProfileId: input.actorProfileId,
            },
            update: { ...currentSecret, updatedByProfileId: input.actorProfileId },
          })
        }
      }
      for (const credential of credentialRows) {
        if (
          current.providerKey === "ABACATE_PAY" &&
          nextWebhookSecret &&
          credential.key === "WEBHOOK_SECRET_PREVIOUS"
        ) continue
        await transaction.paymentProviderCredential.upsert({
          where: { configId_key: { configId: current.id, key: credential.key } },
          create: { ...credential, configId: current.id },
          update: {
            valueCiphertext: credential.valueCiphertext,
            keyId: credential.keyId,
            last4: credential.last4,
            fingerprint: credential.fingerprint,
            updatedByProfileId: credential.updatedByProfileId,
          },
        })
      }
      return transaction.paymentProviderConfig.findUniqueOrThrow({ where: { id: current.id }, select: instanceSelect })
    })
    return toInstanceRecord(updated)
  }

  async getEncrypted(input: {
    provider: CreatePaymentProviderInstanceInput["provider"]
    environment: CreatePaymentProviderInstanceInput["environment"]
    externalAccountContext: string
    key: string
  }): Promise<{ readonly keyId: string; readonly valueCiphertext: string } | null> {
    const row = await prisma.paymentProviderCredential.findFirst({
      where: {
        key: input.key,
        config: {
          providerKey: input.provider,
          environment: input.environment,
          externalAccountContext: input.externalAccountContext,
        },
      },
      select: { keyId: true, valueCiphertext: true },
    })
    return row
  }
}

function fingerprint(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 12)}`
}

function toInstanceRecord(record: {
  id: string
  providerKey: string
  environment: string
  displayName: string | null
  externalAccountContext: string
  enabled: boolean
  rolloutState: string
  isDefault: boolean
  healthStatus: string
  lastHealthCheckAt: Date | null
  logoUrl: string | null
  logoAltText: string | null
  credentials: Array<{ key: string; last4: string | null; fingerprint: string }>
}): PaymentProviderInstanceRecord {
  return {
    ...record,
    provider: record.providerKey as PaymentProviderInstanceRecord["provider"],
    environment: record.environment as PaymentProviderInstanceRecord["environment"],
    credentials: Object.fromEntries(
      record.credentials.map(({ key, last4, fingerprint: credentialFingerprint }) => [key, {
        isSet: true as const,
        last4,
        fingerprint: credentialFingerprint,
      }]),
    ),
  }
}

export const paymentProviderCredentialRepository = new PaymentProviderCredentialRepository()

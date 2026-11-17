import {
  Prisma,
  PaymentProviderEnvironment as PrismaEnvironment,
  PaymentProviderKey as PrismaProvider,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { applyProviderConfigVariables, readStoredProviderConfigVariables, resolveProviderConfigVariables, resolvePublicProviderConfigVariable, summarizeStoredProviderConfigVariables } from "@/lib/payment-provider/config-variables"
import {
  applyProviderRoutingConfigPatch,
  type ProviderRoutingConfigRecord,
} from "@/lib/payment-provider/routing-config"
import type {
  IPaymentProviderConfigRepository,
  RecordProviderHealthCheckInput,
  UpdateProviderRoutingConfigInput,
} from "./IPaymentProviderConfigRepository"

const configSelect = {
  providerKey: true,
  environment: true,
  enabled: true,
  isDefault: true,
  externalAccountContext: true,
  rolloutState: true,
  killSwitch: true,
  cardEnabled: true,
  publicKey: true,
  variables: true,
  configRevision: true,
  healthStatus: true,
} as const

export class PaymentProviderConfigRepository implements IPaymentProviderConfigRepository {
  async list(
    environment: ProviderRoutingConfigRecord["environment"],
  ): Promise<readonly ProviderRoutingConfigRecord[]> {
    const records = await prisma.paymentProviderConfig.findMany({
      where: { environment: toPrismaEnvironment(environment) },
      select: configSelect,
      orderBy: { providerKey: "asc" },
    })
    return records.map(toRoutingConfigRecord)
  }

  async readRuntimeVariables(
    provider: ProviderRoutingConfigRecord["provider"],
    environment: ProviderRoutingConfigRecord["environment"],
    externalAccountContext?: string,
  ): Promise<Readonly<Record<string, string>>> {
    const record = await prisma.paymentProviderConfig.findFirst({
      where: {
        providerKey: toPrismaProvider(provider),
        environment: toPrismaEnvironment(environment),
        ...(externalAccountContext ? { externalAccountContext } : {}),
      },
      select: { variables: true, publicKey: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })
    if (!record) return {}
    const variables = resolveProviderConfigVariables(record.variables)
    const legacyName = `${provider}_${environment}_PUBLIC_KEY`
    if (record.publicKey?.trim() && !variables[legacyName]) variables[legacyName] = record.publicKey.trim()
    return variables
  }

  async readPublicVariable(
    provider: ProviderRoutingConfigRecord["provider"],
    environment: ProviderRoutingConfigRecord["environment"],
    name: string,
    externalAccountContext?: string,
  ): Promise<string | null> {
    const record = await prisma.paymentProviderConfig.findFirst({
      where: {
        providerKey: toPrismaProvider(provider),
        environment: toPrismaEnvironment(environment),
        ...(externalAccountContext ? { externalAccountContext } : {}),
      },
      select: { variables: true, publicKey: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })
    if (!record) return null
    const configured = resolvePublicProviderConfigVariable(record.variables, name)
    if (configured) return configured
    return name === `${provider}_${environment}_PUBLIC_KEY` ? record.publicKey?.trim() || null : null
  }

  async recordHealthCheck(
    input: RecordProviderHealthCheckInput,
  ): Promise<ProviderRoutingConfigRecord> {
    const where = {
      providerKey: toPrismaProvider(input.provider),
      environment: toPrismaEnvironment(input.environment),
    }
    const exists = await prisma.paymentProviderConfig.findFirst({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    })
    if (!exists) throw new Error("Configuração do provider não encontrada")
    const updated = await prisma.paymentProviderConfig.update({
      where: { id: exists.id },
      data: {
        healthStatus: input.healthStatus,
        lastHealthCheckAt: input.checkedAt,
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage,
      },
      select: configSelect,
    })
    return toRoutingConfigRecord(updated)
  }

  async update(input: UpdateProviderRoutingConfigInput): Promise<ProviderRoutingConfigRecord> {
    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.paymentProviderConfig.findFirst({
        where: {
          providerKey: toPrismaProvider(input.provider),
          environment: toPrismaEnvironment(input.environment),
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { ...configSelect, id: true },
      })
      if (!current) throw new Error("Configuração do provider não encontrada")

      const next = applyProviderRoutingConfigPatch(toRoutingConfigRecord(current), input.patch)
      const variables = input.patch.variables === undefined
        ? readStoredProviderConfigVariables(current.variables)
        : applyProviderConfigVariables(current.variables, input.patch.variables)
      const publicKeyName = `${input.provider}_${input.environment}_PUBLIC_KEY`
      const publicKey = input.patch.variables === undefined
        ? next.publicKey
        : variables.find((variable) => variable.name === publicKeyName && variable.visibility === "PUBLIC")?.value ?? null
      if (next.isDefault) {
        await transaction.paymentProviderConfig.updateMany({
          where: {
            environment: current.environment,
            isDefault: true,
            id: { not: current.id },
          },
          data: { isDefault: false, configRevision: { increment: 1 } },
        })
      }

      const result = await transaction.paymentProviderConfig.updateMany({
        where: { id: current.id, configRevision: input.patch.expectedRevision },
        data: {
          enabled: next.enabled,
          isDefault: next.isDefault,
          externalAccountContext: next.externalAccountContext,
          rolloutState: next.rolloutState,
          killSwitch: next.killSwitch,
          cardEnabled: next.cardEnabled,
          publicKey,
          variables,
          configRevision: next.revision,
          healthStatus: next.healthStatus,
        },
      })
      if (result.count !== 1) throw new Error("A revisão da configuração está desatualizada")
      return transaction.paymentProviderConfig.findUniqueOrThrow({
        where: { id: current.id },
        select: configSelect,
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return toRoutingConfigRecord(updated)
  }
}

function toRoutingConfigRecord(record: {
  providerKey: string
  environment: string
  enabled: boolean
  isDefault: boolean
  externalAccountContext: string
  rolloutState: string
  killSwitch: boolean
  cardEnabled: boolean
  publicKey?: string | null
  variables?: unknown
  configRevision: number
  healthStatus: string
}): ProviderRoutingConfigRecord {
  return {
    provider: record.providerKey as ProviderRoutingConfigRecord["provider"],
    environment: record.environment as ProviderRoutingConfigRecord["environment"],
    enabled: record.enabled,
    isDefault: record.isDefault,
    externalAccountContext: record.externalAccountContext,
    rolloutState: record.rolloutState as ProviderRoutingConfigRecord["rolloutState"],
    killSwitch: record.killSwitch,
    cardEnabled: record.cardEnabled,
    publicKey: record.publicKey,
    variables: summarizeStoredProviderConfigVariables(
      record.variables,
      record.publicKey,
      `${record.providerKey}_${record.environment}_PUBLIC_KEY`,
    ),
    revision: record.configRevision,
    healthStatus: record.healthStatus as ProviderRoutingConfigRecord["healthStatus"],
  }
}

function toPrismaProvider(provider: ProviderRoutingConfigRecord["provider"]): PrismaProvider {
  return provider as PrismaProvider
}

function toPrismaEnvironment(
  environment: ProviderRoutingConfigRecord["environment"],
): PrismaEnvironment {
  return environment as PrismaEnvironment
}

export const paymentProviderConfigRepository = new PaymentProviderConfigRepository()

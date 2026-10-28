import {
  Prisma,
  PaymentProviderEnvironment as PrismaEnvironment,
  PaymentProviderKey as PrismaProvider,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
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

  async recordHealthCheck(
    input: RecordProviderHealthCheckInput,
  ): Promise<ProviderRoutingConfigRecord> {
    const where = {
      providerKey_environment: {
        providerKey: toPrismaProvider(input.provider),
        environment: toPrismaEnvironment(input.environment),
      },
    }
    const exists = await prisma.paymentProviderConfig.findUnique({ where, select: { id: true } })
    if (!exists) throw new Error("Configuração do provider não encontrada")
    const updated = await prisma.paymentProviderConfig.update({
      where,
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
      const current = await transaction.paymentProviderConfig.findUnique({
        where: {
          providerKey_environment: {
            providerKey: toPrismaProvider(input.provider),
            environment: toPrismaEnvironment(input.environment),
          },
        },
        select: { ...configSelect, id: true },
      })
      if (!current) throw new Error("Configuração do provider não encontrada")

      const next = applyProviderRoutingConfigPatch(toRoutingConfigRecord(current), input.patch)
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

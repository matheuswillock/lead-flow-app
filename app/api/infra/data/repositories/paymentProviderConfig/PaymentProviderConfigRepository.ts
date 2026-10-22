import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  ProviderInstanceConflictError,
  ProviderInstanceNotFoundError,
  parseStoredSettings,
  pickPrimaryInstance,
  type ProviderInstanceRecord,
} from "@/lib/payment-provider/instance"
import {
  applyProviderRoutingConfigPatch,
  ProviderRoutingConfigError,
} from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type {
  CreateProviderInstanceInput,
  IPaymentProviderConfigRepository,
  RecordProviderHealthCheckInput,
  UpdateProviderInstanceInput,
} from "./IPaymentProviderConfigRepository"

const configSelect = {
  id: true,
  providerKey: true,
  environment: true,
  enabled: true,
  isDefault: true,
  externalAccountContext: true,
  rolloutState: true,
  killSwitch: true,
  configRevision: true,
  healthStatus: true,
  displayName: true,
  logoUrl: true,
  logoAltText: true,
  settings: true,
  lastHealthCheckAt: true,
  lastErrorCode: true,
} as const

type ConfigRow = Prisma.PaymentProviderConfigGetPayload<{ select: typeof configSelect }>

export class PaymentProviderConfigRepository implements IPaymentProviderConfigRepository {
  async list(environment: PaymentProviderEnvironment): Promise<readonly ProviderInstanceRecord[]> {
    const rows = await prisma.paymentProviderConfig.findMany({
      where: { environment },
      select: configSelect,
      orderBy: [{ providerKey: "asc" }, { createdAt: "asc" }],
    })
    return rows.map(toInstanceRecord)
  }

  async listAll(): Promise<readonly ProviderInstanceRecord[]> {
    const rows = await prisma.paymentProviderConfig.findMany({
      select: configSelect,
      orderBy: [{ environment: "asc" }, { providerKey: "asc" }, { createdAt: "asc" }],
    })
    return rows.map(toInstanceRecord)
  }

  async findById(id: string): Promise<ProviderInstanceRecord | null> {
    const row = await prisma.paymentProviderConfig.findUnique({ where: { id }, select: configSelect })
    return row ? toInstanceRecord(row) : null
  }

  async findPrimary(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
  ): Promise<ProviderInstanceRecord | null> {
    const rows = await prisma.paymentProviderConfig.findMany({
      where: { providerKey: provider, environment },
      select: configSelect,
      orderBy: { createdAt: "asc" },
    })
    // Mesmos critérios do roteador (elegível e padrão primeiro): ver pickPrimaryInstance.
    return pickPrimaryInstance(rows.map(toInstanceRecord), provider) ?? null
  }

  async findByScope(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
    externalAccountContext: string,
  ): Promise<ProviderInstanceRecord | null> {
    const row = await prisma.paymentProviderConfig.findUnique({
      where: {
        providerKey_environment_externalAccountContext: {
          providerKey: provider,
          environment,
          externalAccountContext,
        },
      },
      select: configSelect,
    })
    return row ? toInstanceRecord(row) : null
  }

  async create(input: CreateProviderInstanceInput): Promise<ProviderInstanceRecord> {
    try {
      const row = await prisma.paymentProviderConfig.create({
        data: {
          providerKey: input.provider,
          environment: input.environment,
          externalAccountContext: input.externalAccountContext,
          displayName: input.displayName,
          logoUrl: input.logoUrl,
          logoAltText: input.logoAltText,
        },
        select: configSelect,
      })
      return toInstanceRecord(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProviderInstanceConflictError("Já existe uma instância para esta conta")
      }
      throw error
    }
  }

  async update(input: UpdateProviderInstanceInput): Promise<ProviderInstanceRecord> {
    try {
      return await this.updateInTransaction(input)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProviderInstanceConflictError("Já existe uma instância para esta conta")
      }
      throw error
    }
  }

  private async updateInTransaction(input: UpdateProviderInstanceInput) {
    return prisma.$transaction(
      async (transaction) => {
        const row = await transaction.paymentProviderConfig.findUnique({
          where: { id: input.id },
          select: configSelect,
        })
        if (!row) throw new ProviderInstanceNotFoundError()
        const current = toInstanceRecord(row)
        const routing = applyProviderRoutingConfigPatch(current, input.patch)
        const settings = { ...current.settings, ...(input.metadata?.settings ?? {}) }
        const next: ProviderInstanceRecord = {
          ...current,
          ...routing,
          displayName: input.metadata?.displayName ?? current.displayName,
          logoUrl: input.metadata?.logoUrl !== undefined ? input.metadata.logoUrl : current.logoUrl,
          logoAltText:
            input.metadata?.logoAltText !== undefined ? input.metadata.logoAltText : current.logoAltText,
          settings,
        }
        input.assertNext?.(next)
        if (next.isDefault) {
          await transaction.paymentProviderConfig.updateMany({
            where: { environment: row.environment, isDefault: true, id: { not: row.id } },
            data: { isDefault: false, configRevision: { increment: 1 } },
          })
        }
        const result = await transaction.paymentProviderConfig.updateMany({
          where: { id: row.id, configRevision: input.patch.expectedRevision },
          data: {
            enabled: next.enabled,
            isDefault: next.isDefault,
            externalAccountContext: next.externalAccountContext,
            rolloutState: next.rolloutState,
            killSwitch: next.killSwitch,
            configRevision: next.revision,
            healthStatus: next.healthStatus,
            displayName: next.displayName,
            logoUrl: next.logoUrl,
            logoAltText: next.logoAltText,
            settings: next.settings as Prisma.InputJsonValue,
          },
        })
        if (result.count !== 1) {
          throw new ProviderRoutingConfigError(
            "REVISION_CONFLICT",
            "A revisão da configuração está desatualizada",
          )
        }
        const updated = await transaction.paymentProviderConfig.findUniqueOrThrow({
          where: { id: row.id },
          select: configSelect,
        })
        return toInstanceRecord(updated)
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  async recordHealthCheck(input: RecordProviderHealthCheckInput): Promise<ProviderInstanceRecord> {
    const exists = await prisma.paymentProviderConfig.findUnique({
      where: { id: input.id },
      select: { id: true },
    })
    if (!exists) throw new ProviderInstanceNotFoundError()
    const updated = await prisma.paymentProviderConfig.update({
      where: { id: input.id },
      data: {
        ...(input.healthStatus ? { healthStatus: input.healthStatus } : {}),
        lastHealthCheckAt: input.checkedAt,
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage,
      },
      select: configSelect,
    })
    return toInstanceRecord(updated)
  }
}

function toInstanceRecord(row: ConfigRow): ProviderInstanceRecord {
  return {
    id: row.id,
    provider: row.providerKey as ProviderInstanceRecord["provider"],
    environment: row.environment as ProviderInstanceRecord["environment"],
    enabled: row.enabled,
    isDefault: row.isDefault,
    externalAccountContext: row.externalAccountContext,
    rolloutState: row.rolloutState as ProviderInstanceRecord["rolloutState"],
    killSwitch: row.killSwitch,
    revision: row.configRevision,
    healthStatus: row.healthStatus as ProviderInstanceRecord["healthStatus"],
    displayName: row.displayName,
    logoUrl: row.logoUrl,
    logoAltText: row.logoAltText,
    settings: parseStoredSettings(row.settings),
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastErrorCode: row.lastErrorCode,
  }
}

export const paymentProviderConfigRepository = new PaymentProviderConfigRepository()

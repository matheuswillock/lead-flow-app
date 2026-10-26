import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateMigrationGateInput,
  ActivateMigrationGateInput,
  RevokeMigrationGateInput,
  FindActiveMigrationGateInput,
  IPaymentProviderMigrationGateRepository,
} from "./IPaymentProviderMigrationGateRepository"
import type { PaymentProviderMigrationGate } from "@/lib/payment-provider/migration-gate"

const gateSelect = {
  id: true,
  sourceRoute: true,
  targetRoute: true,
  version: true,
  environment: true,
  externalAccountContext: true,
  status: true,
  expiresAt: true,
} as const

export class PaymentProviderMigrationGateRepository implements IPaymentProviderMigrationGateRepository {
  async findActive(
    input: FindActiveMigrationGateInput,
  ): Promise<PaymentProviderMigrationGate | null> {
    await prisma.paymentProviderMigrationGate.updateMany({
      where: {
        status: { in: ["PENDING", "ACTIVE"] },
        expiresAt: { lte: input.now },
      },
      data: { status: "EXPIRED" },
    })
    const gate = await prisma.paymentProviderMigrationGate.findFirst({
      where: {
        sourceRoute: input.sourceRoute,
        targetRoute: input.targetRoute,
        version: input.version,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
        status: "ACTIVE",
        expiresAt: { gt: input.now },
      },
      select: gateSelect,
    })
    return gate ? toGate(gate) : null
  }

  async create(input: CreateMigrationGateInput): Promise<PaymentProviderMigrationGate> {
    if (input.sourceRoute === input.targetRoute) {
      throw new Error("Gate de migração exige rotas diferentes")
    }
    const gate = await prisma.paymentProviderMigrationGate.create({
      data: {
        sourceRoute: input.sourceRoute,
        targetRoute: input.targetRoute,
        version: input.version,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
        authorizedByProfileId: input.authorizedByProfileId,
        expiresAt: input.expiresAt,
      },
      select: gateSelect,
    })
    return toGate(gate)
  }

  async activate(input: ActivateMigrationGateInput): Promise<PaymentProviderMigrationGate> {
    const result = await prisma.paymentProviderMigrationGate.updateMany({
      where: {
        id: input.id,
        authorizedByProfileId: input.authorizedByProfileId,
        status: "PENDING",
        expiresAt: { gt: input.now },
      },
      data: {
        status: "ACTIVE",
        activatedAt: input.now,
      },
    })
    if (result.count !== 1) {
      throw new Error("Gate inexistente, expirado ou já ativado")
    }
    const gate = await prisma.paymentProviderMigrationGate.findUniqueOrThrow({
      where: { id: input.id },
      select: gateSelect,
    })
    return toGate(gate)
  }

  async revoke(input: RevokeMigrationGateInput): Promise<PaymentProviderMigrationGate> {
    const result = await prisma.paymentProviderMigrationGate.updateMany({
      where: {
        id: input.id,
        authorizedByProfileId: input.authorizedByProfileId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      data: {
        status: "REVOKED",
        revokedAt: input.now,
      },
    })
    if (result.count !== 1) throw new Error("Gate inexistente ou já encerrado")
    const gate = await prisma.paymentProviderMigrationGate.findUniqueOrThrow({
      where: { id: input.id },
      select: gateSelect,
    })
    return toGate(gate)
  }
}

function toGate(record: {
  id: string
  sourceRoute: string
  targetRoute: string
  version: string
  environment: string
  externalAccountContext: string
  status: string
  expiresAt: Date
}): PaymentProviderMigrationGate {
  return {
    id: record.id,
    sourceRoute: record.sourceRoute as PaymentProviderMigrationGate["sourceRoute"],
    targetRoute: record.targetRoute as PaymentProviderMigrationGate["targetRoute"],
    version: record.version,
    environment: record.environment as PaymentProviderMigrationGate["environment"],
    externalAccountContext: record.externalAccountContext,
    status: record.status as PaymentProviderMigrationGate["status"],
    expiresAt: record.expiresAt,
  }
}

export const paymentProviderMigrationGateRepository = new PaymentProviderMigrationGateRepository()

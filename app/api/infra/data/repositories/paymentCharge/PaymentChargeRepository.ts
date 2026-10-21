import { prisma } from "@/app/api/infra/data/prisma"
import type { PaymentCharge, PaymentChargeEvent } from "@prisma/client"
import type {
  ChargeExternalIdentity,
  CreatePaymentChargeInput,
  IPaymentChargeRepository,
  ListMirrorChargesInput,
  PaymentChargeBackfill,
  TransitionPaymentChargeInput,
} from "./IPaymentChargeRepository"
import type { ChargePurpose } from "@/lib/payments/types"

export class PaymentChargeRepository implements IPaymentChargeRepository {
  create(input: CreatePaymentChargeInput): Promise<PaymentCharge> {
    const { actor, ...data } = input
    return prisma.$transaction(async (transaction) => {
      const charge = await transaction.paymentCharge.create({ data })
      await transaction.paymentChargeEvent.create({
        data: {
          chargeId: charge.id,
          fromStatus: null,
          toStatus: charge.status,
          rawStatus: charge.rawStatus,
          actor,
        },
      })
      return charge
    })
  }

  findById(id: string): Promise<PaymentCharge | null> {
    return prisma.paymentCharge.findUnique({ where: { id } })
  }

  findByIdempotencyKey(input: {
    profileId: string
    idempotencyKey: string
  }): Promise<PaymentCharge | null> {
    return prisma.paymentCharge.findUnique({
      where: {
        profileId_idempotencyKey: {
          profileId: input.profileId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    })
  }

  // O índice único é parcial (só com id externo), por isso findFirst e não findUnique.
  findByExternalIdentity(input: ChargeExternalIdentity): Promise<PaymentCharge | null> {
    return prisma.paymentCharge.findFirst({
      where: {
        provider: input.provider,
        providerEnvironment: input.providerEnvironment,
        providerContext: input.providerContext,
        providerExternalId: input.providerExternalId,
      },
    })
  }

  findByPurposeRef(input: {
    purpose: ChargePurpose
    purposeRefId: string
  }): Promise<PaymentCharge | null> {
    return prisma.paymentCharge.findFirst({
      where: { purpose: input.purpose, purposeRefId: input.purposeRefId },
      orderBy: { createdAt: "desc" },
    })
  }

  transition(input: TransitionPaymentChargeInput): Promise<PaymentCharge | null> {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.paymentCharge.updateMany({
        where: { id: input.id, status: input.expectedStatus },
        data: {
          status: input.toStatus,
          ...(input.rawStatus !== undefined ? { rawStatus: input.rawStatus } : {}),
        },
      })
      if (updated.count === 0) return null
      // O primeiro paidAt é o instante do pagamento: nunca é regravado (ex.: CONFIRMED -> COMPLETED).
      if (input.paidAt) {
        await transaction.paymentCharge.updateMany({
          where: { id: input.id, paidAt: null },
          data: { paidAt: input.paidAt },
        })
      }
      await transaction.paymentChargeEvent.create({
        data: {
          chargeId: input.id,
          fromStatus: input.expectedStatus,
          toStatus: input.toStatus,
          rawStatus: input.rawStatus ?? null,
          actor: input.actor,
        },
      })
      return transaction.paymentCharge.findUnique({ where: { id: input.id } })
    })
  }

  async backfill(id: string, fields: PaymentChargeBackfill): Promise<PaymentCharge | null> {
    const current = await this.findById(id)
    if (!current) return null
    const data = {
      ...(fields.providerSessionId && !current.providerSessionId
        ? { providerSessionId: fields.providerSessionId }
        : {}),
      ...(fields.providerAttemptId && !current.providerAttemptId
        ? { providerAttemptId: fields.providerAttemptId }
        : {}),
      ...(fields.providerExternalId && !current.providerExternalId
        ? { providerExternalId: fields.providerExternalId }
        : {}),
      ...(fields.paymentInstructions !== undefined && current.paymentInstructions === null
        ? { paymentInstructions: fields.paymentInstructions }
        : {}),
      ...(fields.paidAt && !current.paidAt ? { paidAt: fields.paidAt } : {}),
      ...(fields.rawStatus !== undefined && fields.rawStatus !== current.rawStatus
        ? { rawStatus: fields.rawStatus }
        : {}),
    }
    if (Object.keys(data).length === 0) return current
    return prisma.paymentCharge.update({ where: { id }, data })
  }

  listEvents(chargeId: string): Promise<readonly PaymentChargeEvent[]> {
    return prisma.paymentChargeEvent.findMany({
      where: { chargeId },
      orderBy: { occurredAt: "asc" },
    })
  }

  listForDivergence(input: ListMirrorChargesInput): Promise<readonly PaymentCharge[]> {
    return prisma.paymentCharge.findMany({
      where: {
        source: { in: [...input.sources] },
        createdAt: { gte: input.createdAfter },
        ...(input.afterId ? { id: { gt: input.afterId } } : {}),
      },
      orderBy: { id: "asc" },
      take: input.limit,
    })
  }
}

export const paymentChargeRepository = new PaymentChargeRepository()

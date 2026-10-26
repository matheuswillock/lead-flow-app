import { prisma } from "@/app/api/infra/data/prisma"
import type { BackofficeAdhesionPayment, Prisma } from "@prisma/client"
import type {
  CreateBackofficeAdhesionPaymentInput,
  IBackofficeAdhesionPaymentRepository,
} from "./IBackofficeAdhesionPaymentRepository"

export class BackofficeAdhesionPaymentRepository implements IBackofficeAdhesionPaymentRepository {
  create(input: CreateBackofficeAdhesionPaymentInput): Promise<BackofficeAdhesionPayment> {
    return prisma.backofficeAdhesionPayment.create({ data: { ...input, status: "pending" } })
  }

  findById(id: string): Promise<BackofficeAdhesionPayment | null> {
    return prisma.backofficeAdhesionPayment.findUnique({ where: { id } })
  }

  findByIdempotencyKey(input: {
    adhesionId: string
    idempotencyKey: string
  }): Promise<BackofficeAdhesionPayment | null> {
    return prisma.backofficeAdhesionPayment.findUnique({
      where: {
        adhesionId_idempotencyKey: {
          adhesionId: input.adhesionId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    })
  }

  findLatestByAdhesion(adhesionId: string): Promise<BackofficeAdhesionPayment | null> {
    return prisma.backofficeAdhesionPayment.findFirst({
      where: { adhesionId },
      orderBy: { createdAt: "desc" },
    })
  }

  attachProviderAttempt(input: {
    id: string
    providerSessionId: string
    providerAttemptId: string
    providerExternalId?: string | null
    paymentInstructions?: Prisma.InputJsonValue
  }): Promise<BackofficeAdhesionPayment> {
    return prisma.backofficeAdhesionPayment.update({
      where: { id: input.id },
      data: {
        providerSessionId: input.providerSessionId,
        providerAttemptId: input.providerAttemptId,
        providerExternalId: input.providerExternalId,
        paymentInstructions: input.paymentInstructions,
      },
    })
  }

  async markConfirmed(input: {
    id: string
    providerExternalId: string
    confirmedAt: Date
  }): Promise<BackofficeAdhesionPayment | null> {
    const result = await prisma.backofficeAdhesionPayment.updateMany({
      where: { id: input.id, status: { in: ["pending", "confirmed", "failed"] } },
      data: {
        status: "confirmed",
        providerExternalId: input.providerExternalId,
        confirmedAt: input.confirmedAt,
        failureReason: null,
      },
    })
    if (result.count === 0) {
      const current = await this.findById(input.id)
      return current?.status === "completed" ? current : null
    }
    return this.findById(input.id)
  }

  async markCompleted(id: string, now = new Date()): Promise<BackofficeAdhesionPayment | null> {
    const result = await prisma.backofficeAdhesionPayment.updateMany({
      where: { id, status: "confirmed" },
      data: { status: "completed", completedAt: now },
    })
    if (result.count === 0) return null
    return this.findById(id)
  }

  async markNeedsReview(id: string, reason: string): Promise<BackofficeAdhesionPayment | null> {
    const result = await prisma.backofficeAdhesionPayment.updateMany({
      where: { id, status: { in: ["pending", "confirmed", "failed"] } },
      data: { status: "review", failureReason: reason },
    })
    if (result.count === 0) return null
    return this.findById(id)
  }

  async supersedePending(adhesionId: string): Promise<number> {
    const result = await prisma.backofficeAdhesionPayment.updateMany({
      where: { adhesionId, status: "pending" },
      data: { status: "superseded", failureReason: "superseded_by_adhesion_change" },
    })
    return result.count
  }

  async markFailed(id: string, reason: string): Promise<BackofficeAdhesionPayment | null> {
    const result = await prisma.backofficeAdhesionPayment.updateMany({
      where: { id, status: { in: ["pending", "confirmed"] } },
      data: { status: "failed", failureReason: reason },
    })
    if (result.count === 0) return null
    return this.findById(id)
  }
}

export const backofficeAdhesionPaymentRepository = new BackofficeAdhesionPaymentRepository()

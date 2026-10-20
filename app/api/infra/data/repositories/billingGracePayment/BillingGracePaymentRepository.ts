import { prisma } from "@/app/api/infra/data/prisma"
import type { BillingGracePayment, Prisma } from "@prisma/client"
import type {
  CreateBillingGracePaymentInput,
  IBillingGracePaymentRepository,
} from "./IBillingGracePaymentRepository"

export class BillingGracePaymentRepository implements IBillingGracePaymentRepository {
  async findAccountContext(supabaseId: string) {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        activeTeamId: true,
        fullName: true,
        email: true,
        cpfCnpj: true,
        phone: true,
        isMaster: true,
        subscriptionId: true,
        hasUnlimitedUsers: true,
        hasPermanentSubscription: true,
        teamMemberships: { select: { teamId: true } },
        operators: { select: { id: true } },
      },
    })
    if (!profile || !profile.isMaster) return null
    return {
      accountId: profile.id,
      teamId: profile.activeTeamId,
      subscriptionId: profile.subscriptionId,
      name: profile.fullName ?? profile.email,
      email: profile.email,
      taxId: profile.cpfCnpj ?? "",
      cellphone: profile.phone ?? "",
      hasUnlimitedUsers: profile.hasUnlimitedUsers,
      hasPermanentSubscription: profile.hasPermanentSubscription,
      teamCount: profile.teamMemberships.length,
      distinctUserCount: profile.operators.length,
      totalUsersIncludingMaster: profile.operators.length + 1,
    }
  }

  create(input: CreateBillingGracePaymentInput): Promise<BillingGracePayment> {
    return prisma.billingGracePayment.create({ data: { ...input, status: "pending" } })
  }

  findByIdForAccount(id: string, accountId: string): Promise<BillingGracePayment | null> {
    return prisma.billingGracePayment.findFirst({ where: { id, accountId } })
  }

  findById(id: string): Promise<BillingGracePayment | null> {
    return prisma.billingGracePayment.findUnique({ where: { id } })
  }

  findByIdempotencyKey(input: { accountId: string; idempotencyKey: string }): Promise<BillingGracePayment | null> {
    return prisma.billingGracePayment.findUnique({
      where: { accountId_idempotencyKey: { accountId: input.accountId, idempotencyKey: input.idempotencyKey } },
    })
  }

  attachProviderAttempt(input: {
    id: string
    providerSessionId: string
    providerAttemptId: string
    providerExternalId?: string | null
    paymentInstructions?: Prisma.InputJsonValue
  }): Promise<BillingGracePayment> {
    return prisma.billingGracePayment.update({
      where: { id: input.id },
      data: {
        providerSessionId: input.providerSessionId,
        providerAttemptId: input.providerAttemptId,
        providerExternalId: input.providerExternalId,
        paymentInstructions: input.paymentInstructions,
      },
    })
  }

  markConfirmed(input: {
    id: string
    providerExternalId: string
    confirmedAt: Date
  }): Promise<BillingGracePayment | null> {
    return prisma.billingGracePayment.updateMany({
      where: { id: input.id, status: { in: ["pending", "confirmed"] } },
      data: {
        status: "confirmed",
        providerExternalId: input.providerExternalId,
        confirmedAt: input.confirmedAt,
      },
    }).then(async (result) => {
      if (result.count === 0) return null
      return prisma.billingGracePayment.findUnique({ where: { id: input.id } })
    })
  }

  markFailed(id: string, reason: string): Promise<BillingGracePayment | null> {
    return prisma.billingGracePayment.updateMany({
      where: { id, status: { in: ["pending", "confirmed"] } },
      data: { status: "failed", failureReason: reason },
    }).then(async (result) => {
      if (result.count === 0) return null
      return prisma.billingGracePayment.findUnique({ where: { id } })
    })
  }

  async completeAndRestoreAccess(id: string, now = new Date()): Promise<BillingGracePayment | null> {
    return prisma.$transaction(async (transaction) => {
      const payment = await transaction.billingGracePayment.findFirst({
        where: { id, status: "confirmed" },
      })
      if (!payment) return null

      const nextDueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      await transaction.profile.update({
        where: { id: payment.accountId },
        data: { subscriptionStatus: "active", subscriptionNextDueDate: nextDueDate },
      })
      await transaction.profileSubscription.updateMany({
        where: { profileId: payment.accountId },
        data: { subscriptionStatus: "active", subscriptionNextDueDate: nextDueDate },
      })
      return transaction.billingGracePayment.update({
        where: { id },
        data: { status: "completed", completedAt: now },
      })
    })
  }
}

export const billingGracePaymentRepository = new BillingGracePaymentRepository()

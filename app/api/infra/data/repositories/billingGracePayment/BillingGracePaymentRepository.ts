import { prisma } from "@/app/api/infra/data/prisma"
import type { BillingGracePayment, Prisma } from "@prisma/client"
import {
  resolveActiveTeamAfterRevoke,
  resolveRenewedPeriod,
  type RenewalBilledUser,
} from "@/app/api/shared/billing/renewalQuote"
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
        subscriptionCycle: true,
        subscriptionNextDueDate: true,
        userTypeAssignment: { select: { userType: { select: { slug: true } } } },
        teamsOwned: {
          where: { deletedAt: null },
          select: { name: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })
    if (!profile || !profile.isMaster) return null
    // Member PRO marca o ilimitado como benefício do pacote de 100 dias, que não é mais vendido:
    // na renovação esse ilimitado não segue. O concedido pelo time interno segue.
    const isMemberPro = profile.userTypeAssignment?.userType.slug === "member_pro"
    const extraUsers = await this.findAccountExtraUsers(profile.id)
    return {
      accountId: profile.id,
      teamId: profile.activeTeamId,
      subscriptionId: profile.subscriptionId,
      name: profile.fullName ?? profile.email,
      email: profile.email,
      taxId: profile.cpfCnpj ?? "",
      cellphone: profile.phone ?? "",
      hasUnlimitedUsers: profile.hasUnlimitedUsers,
      hasManualUnlimitedUsers: profile.hasUnlimitedUsers && !isMemberPro,
      hasPermanentSubscription: profile.hasPermanentSubscription,
      currentCycle: profile.subscriptionCycle,
      currentDueDate: profile.subscriptionNextDueDate,
      teams: profile.teamsOwned.map((team) => ({ name: team.name })),
      extraUsers,
    }
  }

  /**
   * Usuários cobrados: membros distintos dos times do master, exceto ele, de qualquer papel
   * (manager conta como usuário comum). Mesma regra do resumo de cobrança.
   */
  private async findAccountExtraUsers(masterId: string): Promise<RenewalBilledUser[]> {
    const members = await prisma.teamMember.findMany({
      where: { team: { masterId, deletedAt: null }, profileId: { not: masterId } },
      select: { role: true, createdAt: true, profile: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })
    const byProfile = new Map<string, RenewalBilledUser>()
    for (const member of members) {
      if (byProfile.has(member.profile.id)) continue
      byProfile.set(member.profile.id, {
        id: member.profile.id,
        name: member.profile.fullName || member.profile.email,
        email: member.profile.email,
        role: String(member.role).toLowerCase(),
      })
    }
    return [...byProfile.values()]
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

      const account = await transaction.profile.findUnique({
        where: { id: payment.accountId },
        select: { subscriptionNextDueDate: true },
      })
      const renewal = resolveRenewedPeriod({ cycle: payment.cycle, currentDueDate: account?.subscriptionNextDueDate ?? null, now })
      const data = {
        subscriptionStatus: "active" as const,
        subscriptionNextDueDate: renewal.nextDueDate,
        ...(renewal.cycle ? { subscriptionCycle: renewal.cycle } : {}),
      }
      await transaction.profile.update({ where: { id: payment.accountId }, data })
      await transaction.profileSubscription.updateMany({ where: { profileId: payment.accountId }, data })
      if (payment.revokedProfileIds.length > 0) {
        await revokeFromAccountTeams(transaction, payment.accountId, payment.revokedProfileIds)
      }
      return transaction.billingGracePayment.update({
        where: { id },
        data: { status: "completed", completedAt: now },
      })
    })
  }
}

/**
 * Tira os usuários que o master não manteve somente dos times desta conta. Os times de outras
 * contas em que a pessoa também está não são tocados; se o time ativo dela era desta conta, ela
 * passa para o time que sobrou (ou fica sem time ativo, se não sobrou nenhum).
 */
async function revokeFromAccountTeams(
  transaction: Prisma.TransactionClient,
  accountId: string,
  profileIds: string[],
): Promise<void> {
  const targets = profileIds.filter((profileId) => profileId !== accountId)
  if (targets.length === 0) return
  const accountTeamIds = (
    await transaction.team.findMany({ where: { masterId: accountId }, select: { id: true } })
  ).map((team) => team.id)
  if (accountTeamIds.length === 0) return

  await transaction.teamMember.deleteMany({
    where: { profileId: { in: targets }, teamId: { in: accountTeamIds } },
  })

  const profiles = await transaction.profile.findMany({
    where: { id: { in: targets } },
    select: { id: true, activeTeamId: true, teamMemberships: { select: { teamId: true }, orderBy: { createdAt: "asc" } } },
  })
  for (const profile of profiles) {
    const nextActiveTeamId = resolveActiveTeamAfterRevoke({
      activeTeamId: profile.activeTeamId,
      revokedTeamIds: accountTeamIds,
      remainingTeamIds: profile.teamMemberships.map((membership) => membership.teamId),
    })
    if (nextActiveTeamId !== profile.activeTeamId) {
      await transaction.profile.update({ where: { id: profile.id }, data: { activeTeamId: nextActiveTeamId } })
    }
  }
}

export const billingGracePaymentRepository = new BillingGracePaymentRepository()

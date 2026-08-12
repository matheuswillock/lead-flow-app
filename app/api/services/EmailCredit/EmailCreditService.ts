import { randomUUID } from "crypto"
import { EmailCreditPlan, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  OVERAGE_RATE_PER_HUNDRED,
  PLAN_CREDITS,
} from "@/lib/email/email-credit-plans"
import { addMonthsInTz, resolveTimezone, startOfMonthInTz } from "@/lib/dates"
import type {
  ApplyPaidPlanInput,
  ApplyPaidPlanResult,
  CreditStatus,
  IEmailCreditService,
  ReserveCreditsResult,
} from "./IEmailCreditService"

export class EmailCreditService implements IEmailCreditService {
  getOverageRatePerHundred(plan: EmailCreditPlan): number {
    return OVERAGE_RATE_PER_HUNDRED[plan]
  }

  formatInsufficientCreditsMessage(requiredAmount: number, available: number): string {
    return `Créditos insuficientes para ${requiredAmount.toLocaleString("pt-BR")} destinatários. Saldo: ${available.toLocaleString("pt-BR")}`
  }

  async getStatus(teamId: string): Promise<CreditStatus> {
    const subscription = await prisma.emailCreditSubscription.findUnique({
      where: { teamId },
      include: {
        usages: {
          where: {
            periodStart: { lte: new Date() },
            periodEnd: { gte: new Date() },
          },
          take: 1,
        },
      },
    })

    if (!subscription || subscription.status !== "active") {
      return {
        hasSubscription: false,
        plan: null,
        monthlyCredits: 0,
        creditsUsed: 0,
        creditsAvailable: 0,
        overageCount: 0,
        overageCharged: 0,
        currentPeriodEnd: null,
      }
    }

    const usage = subscription.usages[0]
    const creditsUsed = usage?.creditsUsed ?? 0
    const overageCount = usage?.overageCount ?? 0
    const overageCharged = usage ? Number(usage.overageCharged) : 0
    const creditsAvailable = Math.max(0, subscription.monthlyCredits - creditsUsed)

    return {
      hasSubscription: true,
      plan: subscription.plan,
      monthlyCredits: subscription.monthlyCredits,
      creditsUsed,
      creditsAvailable,
      overageCount,
      overageCharged,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }
  }

  async hasEnoughCredits(teamId: string, requiredAmount: number): Promise<boolean> {
    const status = await this.getStatus(teamId)
    if (!status.hasSubscription) return false
    return status.creditsAvailable >= requiredAmount
  }

  async reserveCredits(teamId: string, amount: number): Promise<ReserveCreditsResult> {
    if (amount <= 0) return { ok: true }

    const status = await this.getStatus(teamId)
    if (!status.hasSubscription) {
      return { ok: false, reason: "no_subscription", available: 0 }
    }
    if (status.creditsAvailable < amount) {
      return { ok: false, reason: "insufficient_balance", available: status.creditsAvailable }
    }

    const updated = await prisma.$executeRaw`
      UPDATE "corretor_studio_email_credit_usages" AS u
      SET "creditsUsed" = u."creditsUsed" + ${amount}
      FROM "corretor_studio_email_credit_subscriptions" AS s
      WHERE u."subscriptionId" = s."id"
        AND s."teamId" = ${teamId}::uuid
        AND s."status" = 'active'
        AND u."periodStart" <= now()
        AND u."periodEnd" >= now()
        AND u."creditsUsed" + ${amount} <= s."monthlyCredits"
    `

    if (Number(updated) === 0) {
      const refreshed = await this.getStatus(teamId)
      return {
        ok: false,
        reason: refreshed.hasSubscription ? "insufficient_balance" : "no_subscription",
        available: refreshed.creditsAvailable,
      }
    }

    return { ok: true }
  }

  async releaseCredits(teamId: string, amount: number): Promise<void> {
    if (amount <= 0) return

    await prisma.$executeRaw`
      UPDATE "corretor_studio_email_credit_usages" AS u
      SET "creditsUsed" = GREATEST(0, u."creditsUsed" - ${amount})
      FROM "corretor_studio_email_credit_subscriptions" AS s
      WHERE u."subscriptionId" = s."id"
        AND s."teamId" = ${teamId}::uuid
        AND u."periodStart" <= now()
        AND u."periodEnd" >= now()
    `
  }

  async deductCredits(teamId: string, amount: number): Promise<void> {
    const result = await this.reserveCredits(teamId, amount)
    if (!result.ok) {
      throw new Error(
        result.reason === "no_subscription"
          ? "Assinatura de créditos de e-mail não encontrada"
          : this.formatInsufficientCreditsMessage(amount, result.available)
      )
    }
  }

  /**
   * Aplica créditos após pagamento confirmado (webhook). Idempotente por `paymentId`.
   */
  async applyPaidPlan(input: ApplyPaidPlanInput): Promise<ApplyPaidPlanResult> {
    const paymentId = input.paymentId.trim()
    if (!paymentId) {
      throw new Error("paymentId é obrigatório para aplicar créditos")
    }

    const existingGrant = await prisma.emailCreditPaymentGrant.findUnique({
      where: { paymentId },
      select: { id: true },
    })
    if (existingGrant) {
      return { applied: false, alreadyApplied: true }
    }

    const monthlyCredits = PLAN_CREDITS[input.plan]
    const now = new Date()
    const tz = resolveTimezone(input.timezone)
    const periodEnd = startOfMonthInTz(addMonthsInTz(now, 1, tz), tz)

    try {
      await prisma.$transaction(async (tx) => {
        await tx.emailCreditPaymentGrant.create({
          data: {
            id: randomUUID(),
            teamId: input.teamId,
            plan: input.plan,
            paymentId,
            checkoutId: input.checkoutId ?? null,
            monthlyCredits,
          },
        })

        const existing = await tx.emailCreditSubscription.findUnique({
          where: { teamId: input.teamId },
          select: { id: true },
        })

        if (existing) {
          await tx.emailCreditSubscription.update({
            where: { teamId: input.teamId },
            data: {
              plan: input.plan,
              monthlyCredits,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              canceledAt: null,
              updatedAt: now,
            },
          })

          const currentUsage = await tx.emailCreditUsage.findFirst({
            where: {
              subscriptionId: existing.id,
              periodStart: { lte: now },
              periodEnd: { gte: now },
            },
            select: { id: true },
          })

          if (currentUsage) {
            await tx.emailCreditUsage.update({
              where: { id: currentUsage.id },
              data: {
                periodStart: now,
                periodEnd,
                creditsUsed: 0,
                overageCount: 0,
                overageCharged: 0,
              },
            })
          } else {
            await tx.emailCreditUsage.create({
              data: {
                id: randomUUID(),
                subscriptionId: existing.id,
                periodStart: now,
                periodEnd,
                creditsUsed: 0,
                overageCount: 0,
                overageCharged: 0,
              },
            })
          }
        } else {
          const subscription = await tx.emailCreditSubscription.create({
            data: {
              id: randomUUID(),
              teamId: input.teamId,
              plan: input.plan,
              monthlyCredits,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
          })

          await tx.emailCreditUsage.create({
            data: {
              id: randomUUID(),
              subscriptionId: subscription.id,
              periodStart: now,
              periodEnd,
              creditsUsed: 0,
              overageCount: 0,
              overageCharged: 0,
            },
          })
        }
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { applied: false, alreadyApplied: true }
      }
      throw error
    }

    return { applied: true, alreadyApplied: false }
  }
}

export const emailCreditService = new EmailCreditService()

export { PLAN_CREDITS, OVERAGE_RATE_PER_HUNDRED }

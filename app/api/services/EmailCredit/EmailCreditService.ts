import { EmailCreditPlan } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreditStatus,
  IEmailCreditService,
  ReserveCreditsResult,
} from "./IEmailCreditService"

const PLAN_CREDITS: Record<EmailCreditPlan, number> = {
  starter: 1000,
  plus: 5000,
  pro: 10000,
  business: 25000,
}

const OVERAGE_RATE_PER_HUNDRED: Record<EmailCreditPlan, number> = {
  starter: 3.5,
  plus: 3.0,
  pro: 2.5,
  business: 2.0,
}

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
}

export const emailCreditService = new EmailCreditService()

export { PLAN_CREDITS, OVERAGE_RATE_PER_HUNDRED }

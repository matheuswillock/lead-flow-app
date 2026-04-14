import { EmailCreditPlan } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { IEmailCreditService, CreditStatus } from "./IEmailCreditService"

const PLAN_CREDITS: Record<EmailCreditPlan, number> = {
  starter: 1000,
  plus: 5000,
  pro: 10000,
  business: 25000,
}

// Custo por 100 emails excedentes em centavos (BRL)
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

  async getStatus(profileId: string): Promise<CreditStatus> {
    const subscription = await prisma.emailCreditSubscription.findUnique({
      where: { profileId },
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

  async hasEnoughCredits(profileId: string): Promise<boolean> {
    const status = await this.getStatus(profileId)
    // Permite envio mesmo sem créditos (vai para overage), mas requer assinatura ativa
    return status.hasSubscription
  }

  async deductCredits(profileId: string, amount: number): Promise<void> {
    const subscription = await prisma.emailCreditSubscription.findUnique({
      where: { profileId },
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

    if (!subscription) {
      throw new Error("Assinatura de créditos de email não encontrada")
    }

    const usage = subscription.usages[0]
    if (!usage) {
      console.error("[EmailCreditService][deductCredits] Nenhum período de uso ativo encontrado para profileId:", profileId)
      return
    }

    const newCreditsUsed = usage.creditsUsed + amount
    const overageAmount = Math.max(0, newCreditsUsed - subscription.monthlyCredits)
    const previousOverage = Math.max(0, usage.creditsUsed - subscription.monthlyCredits)
    const newOverageEmails = Math.max(0, overageAmount - previousOverage)

    const overageCharge = newOverageEmails > 0
      ? (Math.ceil(newOverageEmails / 100) * this.getOverageRatePerHundred(subscription.plan))
      : 0

    await prisma.emailCreditUsage.update({
      where: { id: usage.id },
      data: {
        creditsUsed: newCreditsUsed,
        overageCount: { increment: Math.max(0, newOverageEmails) },
        overageCharged: { increment: overageCharge },
      },
    })
  }
}

export const emailCreditService = new EmailCreditService()

export { PLAN_CREDITS, OVERAGE_RATE_PER_HUNDRED }

import { randomUUID } from "crypto"
import { EmailCreditPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { emailCreditService, PLAN_CREDITS } from "@/app/api/services/EmailCredit/EmailCreditService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { addMonthsInTz, startOfMonthInTz } from "@/lib/dates"
import { featureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository"

const PLAN_PRICES: Record<EmailCreditPlan, number> = {
  starter: 25.0,
  plus: 100.0,
  pro: 175.0,
  business: 375.0,
}

export class EmailCreditUseCase {
  async subscribe(plan: EmailCreditPlan, ctx: TeamContext): Promise<Output> {
    try {
      const { teamId } = ctx

      const isBetaExempt = await featureAccessRepository.resolveEmailBetaAccess(ctx)
      if (isBetaExempt) {
        return new Output(
          false,
          [],
          ["Usuários no grupo Beta de e-mail não precisam assinar plano de créditos"],
          null
        )
      }

      const existing = await prisma.emailCreditSubscription.findUnique({
        where: { teamId },
      })

      if (existing && existing.status === "active") {
        const periodEnd = new Date(existing.currentPeriodEnd)
        await prisma.emailCreditSubscription.update({
          where: { teamId },
          data: {
            plan,
            monthlyCredits: PLAN_CREDITS[plan],
            updatedAt: new Date(),
          },
        })

        return new Output(
          true,
          [`Plano de créditos alterado para ${plan} com sucesso`],
          [],
          { plan, monthlyCredits: PLAN_CREDITS[plan], pricePerMonth: PLAN_PRICES[plan], currentPeriodEnd: periodEnd }
        )
      }

      const now = new Date()
      const tz = ctx.userTimezone
      const periodEnd = startOfMonthInTz(addMonthsInTz(now, 1, tz), tz)

      const subscription = await prisma.emailCreditSubscription.create({
        data: {
          id: randomUUID(),
          teamId,
          plan,
          monthlyCredits: PLAN_CREDITS[plan],
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })

      await prisma.emailCreditUsage.create({
        data: {
          id: randomUUID(),
          subscriptionId: subscription.id,
          periodStart: now,
          periodEnd: periodEnd,
          creditsUsed: 0,
          overageCount: 0,
          overageCharged: 0,
        },
      })

      return new Output(
        true,
        [`Assinatura de créditos ${plan} ativada com sucesso`],
        [],
        { plan, monthlyCredits: PLAN_CREDITS[plan], pricePerMonth: PLAN_PRICES[plan], currentPeriodEnd: periodEnd }
      )
    } catch (error) {
      console.error("[EmailCreditUseCase][subscribe]", error)
      return new Output(false, [], ["Erro ao ativar assinatura de créditos de e-mail"], null)
    }
  }

  async getStatus(ctx: TeamContext): Promise<Output> {
    try {
      const isBetaExempt = await featureAccessRepository.resolveEmailBetaAccess(ctx)

      if (isBetaExempt) {
        return new Output(true, [], [], {
          hasSubscription: false,
          isBetaExempt: true,
          plan: null,
          monthlyCredits: 0,
          creditsUsed: 0,
          creditsAvailable: 0,
          overageCount: 0,
          overageCharged: 0,
          currentPeriodEnd: null,
          pricePerMonth: null,
          availablePlans: this.getAvailablePlans(),
        })
      }

      const status = await emailCreditService.getStatus(ctx.teamId)

      if (!status.hasSubscription) {
        return new Output(true, [], [], {
          hasSubscription: false,
          isBetaExempt: false,
          plan: null,
          monthlyCredits: 0,
          creditsUsed: 0,
          creditsAvailable: 0,
          overageCount: 0,
          overageCharged: 0,
          currentPeriodEnd: null,
          pricePerMonth: null,
          availablePlans: this.getAvailablePlans(),
        })
      }

      return new Output(true, [], [], {
        hasSubscription: true,
        isBetaExempt: false,
        plan: status.plan,
        monthlyCredits: status.monthlyCredits,
        creditsUsed: status.creditsUsed,
        creditsAvailable: status.creditsAvailable,
        overageCount: status.overageCount,
        overageCharged: status.overageCharged,
        currentPeriodEnd: status.currentPeriodEnd,
        pricePerMonth: status.plan ? PLAN_PRICES[status.plan] : null,
        availablePlans: this.getAvailablePlans(),
      })
    } catch (error) {
      console.error("[EmailCreditUseCase][getStatus]", error)
      return new Output(false, [], ["Erro ao buscar status de créditos de e-mail"], null)
    }
  }

  async cancel(ctx: TeamContext): Promise<Output> {
    try {
      const subscription = await prisma.emailCreditSubscription.findUnique({
        where: { teamId: ctx.teamId },
      })

      if (!subscription || subscription.status !== "active") {
        return new Output(false, [], ["Nenhuma assinatura de créditos ativa encontrada"], null)
      }

      await prisma.emailCreditSubscription.update({
        where: { teamId: ctx.teamId },
        data: {
          status: "canceled",
          canceledAt: new Date(),
        },
      })

      return new Output(true, ["Assinatura de créditos cancelada com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCreditUseCase][cancel]", error)
      return new Output(false, [], ["Erro ao cancelar assinatura de créditos de e-mail"], null)
    }
  }

  private getAvailablePlans() {
    return (Object.keys(PLAN_CREDITS) as EmailCreditPlan[]).map((plan) => ({
      plan,
      monthlyCredits: PLAN_CREDITS[plan],
      pricePerMonth: PLAN_PRICES[plan],
      overageRatePer100: { starter: 3.5, plus: 3.0, pro: 2.5, business: 2.0 }[plan],
    }))
  }
}

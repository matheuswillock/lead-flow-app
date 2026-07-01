import { randomUUID } from "crypto"
import { EmailCreditPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { PLAN_CREDITS } from "@/app/api/services/EmailCredit/EmailCreditService"
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
      const { profileId } = ctx

      const isBetaExempt = await featureAccessRepository.resolveEmailBetaAccess(ctx)
      if (isBetaExempt) {
        return new Output(
          false,
          [],
          ["Usuários no grupo Beta de e-mail não precisam assinar plano de créditos"],
          null
        )
      }

      // Verificar se já tem assinatura ativa
      const existing = await prisma.emailCreditSubscription.findUnique({
        where: { profileId },
      })

      if (existing && existing.status === "active") {
        // Atualizar plano existente
        const now = new Date()
        const periodEnd = new Date(existing.currentPeriodEnd)
        await prisma.emailCreditSubscription.update({
          where: { profileId },
          data: {
            plan,
            monthlyCredits: PLAN_CREDITS[plan],
            updatedAt: now,
          },
        })

        return new Output(
          true,
          [`Plano de créditos alterado para ${plan} com sucesso`],
          [],
          { plan, monthlyCredits: PLAN_CREDITS[plan], pricePerMonth: PLAN_PRICES[plan], currentPeriodEnd: periodEnd }
        )
      }

      // Criar nova assinatura — período termina na meia-noite do 1º do mês seguinte no TZ do usuário
      const now = new Date()
      const tz = ctx.userTimezone
      const periodEnd = startOfMonthInTz(addMonthsInTz(now, 1, tz), tz)

      const subscription = await prisma.emailCreditSubscription.create({
        data: {
          id: randomUUID(),
          profileId,
          plan,
          monthlyCredits: PLAN_CREDITS[plan],
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })

      // Criar uso para o período atual
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
      return new Output(false, [], ["Erro ao ativar assinatura de créditos de email"], null)
    }
  }

  async getStatus(ctx: TeamContext): Promise<Output> {
    try {
      const { profileId } = ctx
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

      const usage = subscription.usages[0]
      const creditsUsed = usage?.creditsUsed ?? 0
      const creditsAvailable = Math.max(0, subscription.monthlyCredits - creditsUsed)

      return new Output(true, [], [], {
        hasSubscription: true,
        isBetaExempt: false,
        plan: subscription.plan,
        monthlyCredits: subscription.monthlyCredits,
        creditsUsed,
        creditsAvailable,
        overageCount: usage?.overageCount ?? 0,
        overageCharged: usage ? Number(usage.overageCharged) : 0,
        currentPeriodEnd: subscription.currentPeriodEnd,
        pricePerMonth: PLAN_PRICES[subscription.plan],
        availablePlans: this.getAvailablePlans(),
      })
    } catch (error) {
      console.error("[EmailCreditUseCase][getStatus]", error)
      return new Output(false, [], ["Erro ao buscar status de créditos de email"], null)
    }
  }

  async cancel(ctx: TeamContext): Promise<Output> {
    try {
      const { profileId } = ctx

      const subscription = await prisma.emailCreditSubscription.findUnique({
        where: { profileId },
      })

      if (!subscription || subscription.status !== "active") {
        return new Output(false, [], ["Nenhuma assinatura de créditos ativa encontrada"], null)
      }

      await prisma.emailCreditSubscription.update({
        where: { profileId },
        data: {
          status: "canceled",
          canceledAt: new Date(),
        },
      })

      return new Output(true, ["Assinatura de créditos cancelada com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCreditUseCase][cancel]", error)
      return new Output(false, [], ["Erro ao cancelar assinatura de créditos de email"], null)
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

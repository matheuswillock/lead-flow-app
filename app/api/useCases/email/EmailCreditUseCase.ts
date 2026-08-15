import { EmailCreditPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { emailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import type { IEmailCreditService } from "@/app/api/services/EmailCredit/IEmailCreditService"
import {
  platformCheckoutUseCase,
  type PlatformCheckoutUseCase,
} from "@/app/api/useCases/platformCheckout/PlatformCheckoutUseCase"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import {
  emailCreditsProductSlug,
  OVERAGE_RATE_PER_HUNDRED,
  PLAN_CREDITS,
  PLAN_PRICES,
} from "@/lib/email/email-credit-plans"

type EmailCreditBillingType = "PIX" | "CREDIT_CARD"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import { getTeamDailyDispatchStatus } from "@/lib/email/campaign-daily-dispatch-guard"
import { resolveTimezone } from "@/lib/dates"
import { assertResendDomainTrackingReady } from "@/lib/email/campaign-dispatch-guards"

export class EmailCreditUseCase {
  constructor(
    private readonly creditService: IEmailCreditService = emailCreditService,
    private readonly checkoutUseCase: PlatformCheckoutUseCase = platformCheckoutUseCase
  ) {}

  private async resolveTeamMasterTimezone(teamId: string): Promise<string> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { master: { select: { timezone: true } } },
    })
    return resolveTimezone(team?.master.timezone)
  }

  private async buildDailyDispatchStatus(ctx: TeamContext) {
    const dailyDispatch = await getTeamDailyDispatchStatus({
      teamId: ctx.teamId,
      timezone: await this.resolveTeamMasterTimezone(ctx.teamId),
      now: new Date(),
    })

    return {
      limit: dailyDispatch.limit,
      used: dailyDispatch.used,
      remaining: dailyDispatch.remaining,
      isUnlimited: dailyDispatch.isUnlimited,
    }
  }

  private async buildTrackingDispatchGate(teamId: string) {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: {
        resendDomainName: true,
        resendDomainStatus: true,
        resendOpenTracking: true,
        resendClickTracking: true,
      },
    })
    const tracking = assertResendDomainTrackingReady({
      domainName: settings?.resendDomainName,
      domainStatus: settings?.resendDomainStatus,
      openTracking: settings?.resendOpenTracking,
      clickTracking: settings?.resendClickTracking,
    })
    return {
      trackingDispatchBlocked: !tracking.ok,
      ...(tracking.ok ? {} : { trackingDispatchBlockReason: tracking.message }),
    }
  }

  /**
   * Inicia compra de créditos via checkout genérico (`PlatformPurchase`, purchaseType=email_credits).
   * NÃO ativa `EmailCreditSubscription` antes do pagamento confirmado.
   */
  async subscribe(
    plan: EmailCreditPlan,
    ctx: TeamContext,
    billingType: EmailCreditBillingType = "PIX"
  ): Promise<Output> {
    try {
      const { teamId, profileId } = ctx

      const isBetaExempt = await featureAccessService.resolveEmailBetaAccess(ctx)
      if (isBetaExempt) {
        return new Output(
          false,
          [],
          ["Usuários no grupo Beta de e-mail não precisam assinar plano de créditos"],
          null
        )
      }

      const checkoutOutput = await this.checkoutUseCase.createCheckout({
        productSlug: emailCreditsProductSlug(plan),
        purchaseType: "email_credits",
        profileId,
        teamId,
        billingType,
        amount: PLAN_PRICES[plan],
        quantity: PLAN_CREDITS[plan],
        description: `Créditos de e-mail — plano ${plan}`,
        metadata: { plan },
      })

      if (!checkoutOutput.isValid || !checkoutOutput.result) {
        return new Output(
          false,
          [],
          checkoutOutput.errorMessages.length > 0
            ? checkoutOutput.errorMessages
            : ["Não foi possível criar o checkout de créditos"],
          null
        )
      }

      const checkout = checkoutOutput.result as {
        checkoutId: string
        checkoutUrl: string
        externalReference: string
        status: string
      }

      return new Output(
        true,
        ["Checkout de créditos criado. Assinatura será ativada após confirmação do pagamento"],
        [],
        {
          checkoutId: checkout.checkoutId,
          checkoutUrl: checkout.checkoutUrl,
          externalReference: checkout.externalReference,
          status: "pending",
          plan,
          monthlyCredits: PLAN_CREDITS[plan],
          pricePerMonth: PLAN_PRICES[plan],
          teamId,
          subscriptionActivated: false,
        }
      )
    } catch (error) {
      console.error("[EmailCreditUseCase][subscribe]", error)
      return new Output(false, [], ["Erro ao criar checkout de créditos de e-mail"], null)
    }
  }

  async getStatus(ctx: TeamContext): Promise<Output> {
    try {
      const isBetaExempt = await featureAccessService.resolveEmailBetaAccess(ctx)

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
          dailyDispatch: await this.buildDailyDispatchStatus(ctx),
          ...(await this.buildTrackingDispatchGate(ctx.teamId)),
        })
      }

      const status = await this.creditService.getStatus(ctx.teamId)

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
          dailyDispatch: await this.buildDailyDispatchStatus(ctx),
          ...(await this.buildTrackingDispatchGate(ctx.teamId)),
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
        dailyDispatch: await this.buildDailyDispatchStatus(ctx),
        ...(await this.buildTrackingDispatchGate(ctx.teamId)),
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
      overageRatePer100: OVERAGE_RATE_PER_HUNDRED[plan],
    }))
  }
}

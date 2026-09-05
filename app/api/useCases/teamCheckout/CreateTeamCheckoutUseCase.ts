import type { UserFunction, UserRole } from "@prisma/client"
import { Output } from "@/lib/output"
import { emailService } from "@/lib/services/EmailService"
import { getFullUrl } from "@/lib/utils/app-url"
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService"
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase"
import type { IIncrementalBillingService } from "@/app/api/services/billing/IIncrementalBillingService"
import { teamCheckoutRepository } from "@/app/api/infra/data/repositories/teamCheckout/TeamCheckoutRepository"
import type { ITeamCheckoutRepository } from "@/app/api/infra/data/repositories/teamCheckout/ITeamCheckoutRepository"

export interface CreateTeamCheckoutInput {
  requesterProfileId: string
  masterProfileId: string
  teamName: string
  billingType: "PIX" | "CREDIT_CARD"
  requesterRole: UserRole
  requesterFunctions: UserFunction[]
}

/**
 * Refatorado da rota (achado codex[bot] no PR #1134): a rota estava em
 * `prismaInV1RouteAllowlist` + `serviceImportOutsideUseCaseAllowlist`.
 * Route→UseCase→Service/Repository→Prisma — nenhum acesso direto ao Prisma
 * ou import de Service fora desta camada.
 */
export class CreateTeamCheckoutUseCase {
  constructor(
    private readonly repository: ITeamCheckoutRepository = teamCheckoutRepository,
    private readonly billingService: IIncrementalBillingService = incrementalBillingService
  ) {}

  async execute(input: CreateTeamCheckoutInput): Promise<Output> {
    try {
      const [requester, master] = await Promise.all([
        this.repository.findRequesterProfile(input.requesterProfileId),
        this.repository.findMasterProfile(input.masterProfileId),
      ])

      if (!requester || !master) {
        return new Output(false, [], ["Perfil não encontrado"], null)
      }

      if (master.hasPermanentSubscription) {
        return await this.createTeamWithoutCharge(input, requester, master)
      }

      if (await memberProBillingUseCase.shouldBypassIncrementalCharge(master.id)) {
        const created = await this.createTeamWithoutCharge(input, requester, master)
        await memberProBillingUseCase.syncUsageToSubscription(master.id, "add_team")
        return created
      }

      if (!master.subscriptionStatus || master.subscriptionStatus === "canceled") {
        return new Output(false, [], ["Master nao possui assinatura ativa"], null)
      }

      const isExternalSubscription = !master.asaasSubscriptionId
      const subscriptionEnd = master.subscriptionEndDate ?? master.subscriptionNextDueDate
      if (isExternalSubscription && subscriptionEnd && subscriptionEnd.getTime() < Date.now()) {
        return new Output(
          false,
          [],
          ["Assinatura externa expirada. Solicite renovação ao backoffice."],
          null
        )
      }

      const proportionalData = await this.billingService.calculateProportionalAmount(
        master.id,
        "team"
      )
      const { billingDelta, totalCharge } = proportionalData

      if (billingDelta === 0) {
        return await this.createTeamWithoutCharge(input, requester, master)
      }

      const pendingPayload = {
        teamName: input.teamName,
        billingType: input.billingType,
        requestedByProfileId: requester.id,
        requestedByName: requester.fullName || requester.email,
        requestedByEmail: requester.email,
        requestedByFunctions: requester.functions,
        billingDelta,
        totalCharge,
        remainingMonths: proportionalData.remainingMonths,
        maxInstallments: proportionalData.maxInstallments,
      }

      const pendingAction = await this.repository.createPendingAction(master.id, pendingPayload)
      const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`)

      await emailService.sendAddOnPendingPaymentEmail({
        masterName: master.fullName || master.email,
        masterEmail: master.email,
        addonType: "team",
        addonLabel: "Time adicional",
        addonDetail: input.teamName,
        totalCharge,
        remainingMonths: proportionalData.remainingMonths,
        checkoutUrl,
        requesterName: requester.fullName || requester.email,
        requesterEmail: requester.email,
      })

      return new Output(
        true,
        ["Cobrança pendente criada. Um link de pagamento foi enviado."],
        [],
        { pendingActionId: pendingAction.id, checkoutUrl }
      )
    } catch (error: unknown) {
      console.error("[CreateTeamCheckoutUseCase][execute] Erro:", error)
      const message = error instanceof Error ? error.message : "Erro ao criar pagamento"
      return new Output(false, [], [message], null)
    }
  }

  private async createTeamWithoutCharge(
    input: CreateTeamCheckoutInput,
    requester: { id: string; fullName: string | null; email: string },
    master: { id: string; fullName: string | null; email: string }
  ): Promise<Output> {
    await this.repository.createTeamWithMember({
      masterId: master.id,
      teamName: input.teamName,
      memberProfileId: requester.id,
      memberRole: input.requesterRole,
      memberFunctions: input.requesterFunctions,
    })

    await emailService.sendAddOnConfirmedEmail({
      masterName: master.fullName || master.email,
      masterEmail: master.email,
      addonType: "team",
      addonLabel: "Time adicional",
      addonDetail: input.teamName,
      requesterName: requester.fullName || requester.email,
      requesterEmail: requester.email,
    })

    return new Output(true, ["Time criado com sucesso sem cobrança adicional"], [], {
      created: true,
    })
  }
}

export const createTeamCheckoutUseCase = new CreateTeamCheckoutUseCase()

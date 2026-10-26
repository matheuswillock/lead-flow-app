import { Output } from "@/lib/output"
import type { IAccountAccessDecisionRepository } from "@/app/api/shared/accountAccessDecision/types"
import type { IAccountAccessDecisionService } from "@/app/api/services/accountAccessDecision/IAccountAccessDecisionService"
import { AccountAccessDecisionService } from "@/app/api/services/accountAccessDecision/AccountAccessDecisionService"
import { AccountAccessDecisionRepository } from "@/app/api/infra/data/repositories/accountAccessDecision/AccountAccessDecisionRepository"

export type AccountAccessDecisionInput = { profileId: string; teamId?: string | null }

export class AccountAccessDecisionUseCase {
  constructor(
    private readonly repository: IAccountAccessDecisionRepository,
    private readonly service: IAccountAccessDecisionService = new AccountAccessDecisionService()
  ) {}

  async execute(input: AccountAccessDecisionInput): Promise<Output> {
    try {
      const account = await this.repository.resolveAccount(input)
      if (!account) {
        return new Output(false, [], ["Conta de assinatura não encontrada"], null)
      }

      const decision = this.service.decide(account)
      if (decision.state === "allowed") {
        return new Output(true, [], [], decision)
      }

      return new Output(true, [], [], {
        ...decision,
        isBillingOwner: account.billingOwnerId === input.profileId,
      })
    } catch (error) {
      console.error("[AccountAccessDecisionUseCase][execute]", error)
      return new Output(false, [], ["Erro ao resolver o acesso da conta"], null)
    }
  }

  async executeForTeam(teamId: string): Promise<Output> {
    const profileId = await this.repository.resolveTeamMasterProfileId?.(teamId)
    if (!profileId) return new Output(false, [], ["Conta de assinatura não encontrada"], null)
    return this.execute({ profileId, teamId })
  }

  async executeForAuthenticatedSupabaseId(supabaseId: string): Promise<Output> {
    try {
      const profileId = await this.repository.resolveProfileId(supabaseId)
      if (!profileId) {
        return new Output(false, [], ["Perfil não encontrado"], null)
      }

      return this.execute({ profileId })
    } catch (error) {
      console.error("[AccountAccessDecisionUseCase][executeForAuthenticatedSupabaseId]", error)
      return new Output(false, [], ["Erro ao resolver o acesso da conta"], null)
    }
  }
}

export const accountAccessDecisionUseCase = new AccountAccessDecisionUseCase(
  new AccountAccessDecisionRepository()
)

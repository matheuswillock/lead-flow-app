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

      return new Output(true, [], [], this.service.decide(account))
    } catch (error) {
      console.error("[AccountAccessDecisionUseCase][execute]", error)
      return new Output(false, [], ["Erro ao resolver o acesso da conta"], null)
    }
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

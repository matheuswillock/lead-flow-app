import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase"
import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { Output } from "@/lib/output"

export class PublicFormAccountAccessUseCase {
  private buildDecisionOutput(access: Output): Output {
    const decision = access.result as AccountAccessDecision | null
    return access.isValid && decision?.state === "allowed"
      ? new Output(true, [], [], null)
      : new Output(false, [], ["O acesso desta conta está pausado"], null)
  }

  async execute(publicId: string): Promise<Output> {
    const teamId = await publicFormsRepository.findTeamIdByPublicId(publicId)
    if (!teamId) return new Output(false, [], ["Formulário indisponível"], null)
    return this.executeForTeam(teamId)
  }

  async executeForTeam(teamId: string): Promise<Output> {
    const access = await accountAccessDecisionUseCase.executeForTeam(teamId)
    return this.buildDecisionOutput(access)
  }
}

export const publicFormAccountAccessUseCase = new PublicFormAccountAccessUseCase()

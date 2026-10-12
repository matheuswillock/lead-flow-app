import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase"
import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { Output } from "@/lib/output"

export class PublicFormAccountAccessUseCase {
  async execute(publicId: string): Promise<Output> {
    const teamId = await publicFormsRepository.findTeamIdByPublicId(publicId)
    if (!teamId) return new Output(false, [], ["Formulário indisponível"], null)
    const access = await accountAccessDecisionUseCase.executeForTeam(teamId)
    const decision = access.result as AccountAccessDecision | null
    return access.isValid && decision?.state === "allowed"
      ? new Output(true, [], [], null)
      : new Output(false, [], ["O acesso desta conta está pausado"], null)
  }
}

export const publicFormAccountAccessUseCase = new PublicFormAccountAccessUseCase()

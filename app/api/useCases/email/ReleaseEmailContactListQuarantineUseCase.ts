import { Output } from "@/lib/output"
import {
  emailContactListRepository,
} from "@/app/api/infra/data/repositories/emailContactList/EmailContactListRepository"
import type {
  IEmailContactListQuarantineRepository,
} from "@/app/api/infra/data/repositories/emailContactList/EmailContactListRepository"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

/**
 * Liberação explícita da quarentena do gate de importação (manager/owner —
 * o gate de papel fica na rota, via `isManagerLikeRole`). A liberação assume
 * o custo de reputação de enviar para uma lista que o gate classificou como
 * risco ALTO — o aviso vive no botão da UI.
 */
export class ReleaseEmailContactListQuarantineUseCase {
  constructor(
    private readonly repository: IEmailContactListQuarantineRepository = emailContactListRepository
  ) {}

  async execute(listId: string, ctx: TeamContext): Promise<Output> {
    try {
      const state = await this.repository.getQuarantineState(listId, ctx.teamId)
      if (!state) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }
      if (!state.isQuarantined) {
        return new Output(false, [], ["A lista não está em quarentena"], null)
      }

      const { released } = await this.repository.releaseQuarantine({
        listId,
        teamId: ctx.teamId,
        releasedBy: ctx.profileId,
        now: new Date(),
      })

      if (!released) {
        return new Output(false, [], ["Não foi possível liberar a lista — tente novamente"], null)
      }

      console.info(
        `[ReleaseEmailContactListQuarantineUseCase] lista ${listId} liberada por ${ctx.profileId}`
      )
      return new Output(true, [`Lista "${state.name}" liberada da quarentena`], [], {
        listId,
        listName: state.name,
      })
    } catch (error) {
      console.error("[ReleaseEmailContactListQuarantineUseCase][execute]", error)
      return new Output(false, [], ["Erro ao liberar a lista da quarentena"], null)
    }
  }
}

export const releaseEmailContactListQuarantineUseCase =
  new ReleaseEmailContactListQuarantineUseCase()

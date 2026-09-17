import { Output } from "@/lib/output"
import {
  backofficeTeamSendingHealthService,
} from "@/app/api/services/backofficeTeamSendingHealth/BackofficeTeamSendingHealthService"
import type {
  BackofficeSendingHealthAction,
  IBackofficeTeamSendingHealthService,
} from "@/app/api/services/backofficeTeamSendingHealth/IBackofficeTeamSendingHealthService"

export interface IBackofficeTeamSendingHealthUseCase {
  list(teamIds?: string[]): Promise<Output>
  applyAction(teamId: string, action: BackofficeSendingHealthAction): Promise<Output>
}

/**
 * Backoffice: visibilidade da trava de reputação por time + liberar/forçar
 * pausa. `suspended` só sai por aqui (o produto recusa) — ver
 * `resolveManualSendingHealthRelease` em `lib/email/sending-health.ts`.
 */
export class BackofficeTeamSendingHealthUseCase
  implements IBackofficeTeamSendingHealthUseCase
{
  constructor(
    private readonly service: IBackofficeTeamSendingHealthService = backofficeTeamSendingHealthService
  ) {}

  async list(teamIds?: string[]): Promise<Output> {
    try {
      const teams = await this.service.list(teamIds)
      return new Output(true, [], [], { teams })
    } catch (error) {
      console.error("[BackofficeTeamSendingHealthUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar saúde de envio dos times"], null)
    }
  }

  async applyAction(teamId: string, action: BackofficeSendingHealthAction): Promise<Output> {
    try {
      if (action !== "release" && action !== "pause") {
        return new Output(false, [], ["Ação inválida — use release ou pause"], null)
      }
      const result = await this.service.applyAction({ teamId, action })
      if (!result.ok) {
        return new Output(false, [], [result.message], null)
      }
      const actionLabel = action === "release" ? "liberado" : "pausado"
      return new Output(true, [`Envio ${actionLabel} — status atual: ${result.status}`], [], {
        teamId,
        status: result.status,
      })
    } catch (error) {
      console.error("[BackofficeTeamSendingHealthUseCase][applyAction]", error)
      return new Output(false, [], ["Erro ao aplicar ação de saúde de envio"], null)
    }
  }
}

export const backofficeTeamSendingHealthUseCase = new BackofficeTeamSendingHealthUseCase()

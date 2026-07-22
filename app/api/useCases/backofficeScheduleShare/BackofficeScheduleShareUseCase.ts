import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import { BackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/BackofficeLeadScheduleRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import { BackofficeScheduleShareService } from "@/app/api/services/Backoffice/backofficeScheduleShare/BackofficeScheduleShareService"
import type { IBackofficeScheduleShareService } from "@/app/api/services/Backoffice/backofficeScheduleShare/IBackofficeScheduleShareService"

export interface IBackofficeScheduleShareUseCase {
  createPublicShare(leadId: string): Promise<Output>
  getPublicShare(token: string): Promise<Output>
}

export class BackofficeScheduleShareUseCase implements IBackofficeScheduleShareUseCase {
  constructor(private readonly service: IBackofficeScheduleShareService) {}

  async createPublicShare(leadId: string): Promise<Output> {
    try {
      const result = await this.service.createPublicShare({ leadId })
      return new Output(true, ["Link público gerado com sucesso"], [], result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao gerar link público do agendamento"
      console.error("[BackofficeScheduleShareUseCase][createPublicShare]", error)
      return new Output(false, [], [message], null)
    }
  }

  async getPublicShare(token: string): Promise<Output> {
    try {
      const result = await this.service.getPublicShare(token)
      return new Output(true, [], [], result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar agendamento público"
      console.error("[BackofficeScheduleShareUseCase][getPublicShare]", error)
      return new Output(false, [], [message], null)
    }
  }
}

export const backofficeScheduleShareUseCase = new BackofficeScheduleShareUseCase(
  new BackofficeScheduleShareService(
    new BackofficeLeadRepository(),
    new BackofficeLeadScheduleRepository(),
    new BackofficeUserRepository()
  )
)

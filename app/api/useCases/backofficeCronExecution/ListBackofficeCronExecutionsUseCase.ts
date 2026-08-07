import { Output } from "@/lib/output"
import { backofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository"
import type { ListBackofficeCronExecutionsParams } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository"

export class ListBackofficeCronExecutionsUseCase {
  async execute(params?: ListBackofficeCronExecutionsParams): Promise<Output> {
    try {
      const executions = await backofficeCronExecutionRepository.findMany(params)

      return new Output(
        true,
        ["Execuções listadas com sucesso"],
        [],
        { executions }
      )
    } catch (error) {
      console.error("[ListBackofficeCronExecutionsUseCase][execute]", error)
      return new Output(
        false,
        [],
        ["Erro ao listar execuções de cron"],
        null
      )
    }
  }
}

export const listBackofficeCronExecutionsUseCase = new ListBackofficeCronExecutionsUseCase()

import { Output } from "@/lib/output"
import { emailDeliverabilityBackfillRepository, type IEmailDeliverabilityBackfillRepository } from "@/app/api/infra/data/repositories/emailDeliverabilityBackfill/EmailDeliverabilityBackfillRepository"

export class BackfillEmailDeliverabilityUseCase {
  constructor(private readonly repository: IEmailDeliverabilityBackfillRepository = emailDeliverabilityBackfillRepository) {}

  async execute(): Promise<Output> {
    try {
      const result = await this.repository.backfill()
      return new Output(true, ["Backfill de deliverability concluído"], [], result)
    } catch (error) {
      console.error("[BackfillEmailDeliverabilityUseCase][execute]", error)
      return new Output(false, [], ["Falha no backfill de deliverability"], null)
    }
  }
}

export const backfillEmailDeliverabilityUseCase = new BackfillEmailDeliverabilityUseCase()

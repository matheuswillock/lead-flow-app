import { Output } from "@/lib/output"
import { backofficeCnaeRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCnae/BackofficeCnaeRepository"
import type { IBackofficeCnaeRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCnae/IBackofficeCnaeRepository"

export class BackofficeCnaeUseCase {
  constructor(private readonly repo: IBackofficeCnaeRepository) {}

  async list(q?: string): Promise<Output> {
    const items = await this.repo.search(q)
    return new Output(true, [], [], { items })
  }
}

export const backofficeCnaeUseCase = new BackofficeCnaeUseCase(backofficeCnaeRepository)

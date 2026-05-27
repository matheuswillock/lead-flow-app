import { randomUUID } from "node:crypto"
import { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import type { CreateDemoLeadInput, IBackofficeDemoLeadUseCase } from "./IBackofficeDemoLeadUseCase"

export class BackofficeDemoLeadUseCase implements IBackofficeDemoLeadUseCase {
  constructor(private readonly leadRepository: IBackofficeLeadRepository) {}

  async create(input: CreateDemoLeadInput): Promise<Output> {
    try {
      const lead = await this.leadRepository.create({
        id: randomUUID(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        status: BackofficeLeadStatus.new_opportunity,
        origin: BackofficeLeadOrigin.landing_page,
        createdByProfileId: null,
      })

      console.info("[BackofficeDemoLeadUseCase][create] Lead criado com sucesso", { id: lead.id })

      return new Output(true, ["Lead criado com sucesso"], [], { id: lead.id })
    } catch (error) {
      console.error("[BackofficeDemoLeadUseCase][create] Erro ao criar lead", error)
      return new Output(false, [], ["Erro ao registrar lead"], null)
    }
  }
}

export const backofficeDemoLeadUseCase = new BackofficeDemoLeadUseCase(
  new BackofficeLeadRepository()
)

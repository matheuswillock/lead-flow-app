import { Output } from "@/lib/output"
import {
  backofficeTeamEmailLimitGrantService,
} from "@/app/api/services/backofficeTeamEmailLimitGrant/BackofficeTeamEmailLimitGrantService"
import type { IBackofficeTeamEmailLimitGrantService } from "@/app/api/services/backofficeTeamEmailLimitGrant/IBackofficeTeamEmailLimitGrantService"

export interface IBackofficeTeamEmailLimitGrantUseCase {
  list(): Promise<Output>
  searchTeams(query: string): Promise<Output>
  grant(
    teamId: string,
    maxEmailsPerDay: number | null,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<Output>
  update(
    grantId: string,
    grantedByProfileId: string,
    input: { maxEmailsPerDay?: number | null; notes?: string | null }
  ): Promise<Output>
  revoke(grantId: string, revokedByProfileId: string): Promise<Output>
}

export class BackofficeTeamEmailLimitGrantUseCase implements IBackofficeTeamEmailLimitGrantUseCase {
  constructor(
    private readonly service: IBackofficeTeamEmailLimitGrantService = backofficeTeamEmailLimitGrantService
  ) {}

  async list(): Promise<Output> {
    try {
      const grants = await this.service.list()
      return new Output(true, [], [], { grants })
    } catch (error) {
      console.error("[BackofficeTeamEmailLimitGrantUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar limites de e-mail por time"], null)
    }
  }

  async searchTeams(query: string): Promise<Output> {
    try {
      const teams = await this.service.searchTeams(query)
      return new Output(true, [], [], { teams })
    } catch (error) {
      console.error("[BackofficeTeamEmailLimitGrantUseCase][searchTeams]", error)
      return new Output(false, [], ["Erro ao buscar times"], null)
    }
  }

  async grant(
    teamId: string,
    maxEmailsPerDay: number | null,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<Output> {
    try {
      const result = await this.service.grant({
        teamId,
        maxEmailsPerDay,
        notes,
        grantedByProfileId,
      })
      if ("error" in result) {
        return new Output(false, [], [result.error], null)
      }
      return new Output(true, ["Limite de e-mail concedido com sucesso"], [], result.grant)
    } catch (error) {
      console.error("[BackofficeTeamEmailLimitGrantUseCase][grant]", error)
      return new Output(false, [], ["Erro ao conceder limite de e-mail"], null)
    }
  }

  async update(
    grantId: string,
    grantedByProfileId: string,
    input: { maxEmailsPerDay?: number | null; notes?: string | null }
  ): Promise<Output> {
    try {
      const result = await this.service.update(grantId, {
        ...input,
        grantedByProfileId,
      })
      if ("error" in result) {
        return new Output(false, [], [result.error], null)
      }
      return new Output(true, ["Limite de e-mail atualizado com sucesso"], [], result.grant)
    } catch (error) {
      console.error("[BackofficeTeamEmailLimitGrantUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar limite de e-mail"], null)
    }
  }

  async revoke(grantId: string, revokedByProfileId: string): Promise<Output> {
    try {
      const result = await this.service.revoke(grantId, revokedByProfileId)
      if ("error" in result) {
        return new Output(false, [], [result.error], null)
      }
      return new Output(true, ["Autorização revogada com sucesso"], [], result.grant)
    } catch (error) {
      console.error("[BackofficeTeamEmailLimitGrantUseCase][revoke]", error)
      return new Output(false, [], ["Erro ao revogar autorização"], null)
    }
  }
}

export const backofficeTeamEmailLimitGrantUseCase = new BackofficeTeamEmailLimitGrantUseCase()

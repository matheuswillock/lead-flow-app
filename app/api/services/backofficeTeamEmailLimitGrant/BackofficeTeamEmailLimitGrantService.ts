import type {
  IBackofficeTeamEmailLimitGrantRepository,
  TeamEmailLimitGrantRow,
  TeamSearchRow,
} from "@/app/api/infra/data/repositories/backofficeTeamEmailLimitGrant/IBackofficeTeamEmailLimitGrantRepository"
import { backofficeTeamEmailLimitGrantRepository } from "@/app/api/infra/data/repositories/backofficeTeamEmailLimitGrant/BackofficeTeamEmailLimitGrantRepository"
import type { IBackofficeTeamEmailLimitGrantService } from "./IBackofficeTeamEmailLimitGrantService"
import { validateTeamEmailLimitMaxPerDay } from "@/lib/backoffice/validate-team-email-limit"

function validateMaxEmailsPerDay(value: number | null | undefined): string | null {
  return validateTeamEmailLimitMaxPerDay(value)
}

export class BackofficeTeamEmailLimitGrantService implements IBackofficeTeamEmailLimitGrantService {
  constructor(
    private readonly repository: IBackofficeTeamEmailLimitGrantRepository = backofficeTeamEmailLimitGrantRepository
  ) {}

  async list(): Promise<TeamEmailLimitGrantRow[]> {
    return this.repository.listActive()
  }

  async searchTeams(query: string): Promise<TeamSearchRow[]> {
    return this.repository.searchTeams(query)
  }

  async grant(input: {
    teamId: string
    maxEmailsPerDay: number | null
    notes?: string | null
    grantedByProfileId: string
  }): Promise<{ grant: TeamEmailLimitGrantRow } | { error: string }> {
    const validationError = validateMaxEmailsPerDay(input.maxEmailsPerDay)
    if (validationError) return { error: validationError }

    const team = await this.repository.findTeamById(input.teamId)
    if (!team) return { error: "Time não encontrado" }

    const grant = await this.repository.upsertGrant(input)
    return { grant }
  }

  async update(
    grantId: string,
    input: {
      maxEmailsPerDay?: number | null
      notes?: string | null
      grantedByProfileId: string
    }
  ): Promise<{ grant: TeamEmailLimitGrantRow } | { error: string }> {
    if (input.maxEmailsPerDay !== undefined) {
      const validationError = validateMaxEmailsPerDay(input.maxEmailsPerDay)
      if (validationError) return { error: validationError }
    }

    const grant = await this.repository.updateGrant(grantId, input)
    if (!grant) return { error: "Autorização não encontrada ou já revogada" }
    return { grant }
  }

  async revoke(
    grantId: string,
    revokedByProfileId: string
  ): Promise<{ grant: TeamEmailLimitGrantRow } | { error: string }> {
    const grant = await this.repository.revoke(grantId, revokedByProfileId)
    if (!grant) return { error: "Autorização não encontrada ou já revogada" }
    return { grant }
  }
}

export const backofficeTeamEmailLimitGrantService = new BackofficeTeamEmailLimitGrantService()

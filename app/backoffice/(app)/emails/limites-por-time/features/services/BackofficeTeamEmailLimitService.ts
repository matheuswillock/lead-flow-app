import type { IBackofficeTeamEmailLimitService } from "./IBackofficeTeamEmailLimitService"
import type {
  TeamEmailLimitGrantItem,
  TeamSearchItem,
} from "../context/BackofficeTeamEmailLimitTypes"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? "Erro ao processar solicitação")
  }
  return data.result
}

export class BackofficeTeamEmailLimitService implements IBackofficeTeamEmailLimitService {
  async list(): Promise<{ grants: TeamEmailLimitGrantItem[] }> {
    return parseOutput<{ grants: TeamEmailLimitGrantItem[] }>(
      await fetch("/api/v1/backoffice/team-email-limit-grants", { cache: "no-store" })
    )
  }

  async searchTeams(query: string): Promise<{ teams: TeamSearchItem[] }> {
    const params = new URLSearchParams({ q: query })
    return parseOutput<{ teams: TeamSearchItem[] }>(
      await fetch(`/api/v1/backoffice/team-email-limit-grants?${params.toString()}`, {
        cache: "no-store",
      })
    )
  }

  async grant(
    teamId: string,
    maxEmailsPerDay: number | null,
    notes?: string | null
  ): Promise<TeamEmailLimitGrantItem> {
    return parseOutput<TeamEmailLimitGrantItem>(
      await fetch("/api/v1/backoffice/team-email-limit-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, maxEmailsPerDay, notes }),
      })
    )
  }

  async revoke(grantId: string): Promise<void> {
    await parseOutput<unknown>(
      await fetch(`/api/v1/backoffice/team-email-limit-grants/${grantId}`, {
        method: "DELETE",
      })
    )
  }
}

export const backofficeTeamEmailLimitService = new BackofficeTeamEmailLimitService()

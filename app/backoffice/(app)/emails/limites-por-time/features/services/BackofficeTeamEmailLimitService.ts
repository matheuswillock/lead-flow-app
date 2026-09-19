import type { IBackofficeTeamEmailLimitService } from "./IBackofficeTeamEmailLimitService"
import type {
  SendingHealthAction,
  TeamEmailLimitGrantItem,
  TeamSearchItem,
  TeamSendingHealthItem,
} from "../context/BackofficeTeamEmailLimitTypes"
import { API_CLIENT_BASE } from "@/lib/route-map";

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
      await fetch(`${API_CLIENT_BASE}/backoffice/team-email-limit-grants`, { cache: "no-store" })
    )
  }

  async searchTeams(query: string): Promise<{ teams: TeamSearchItem[] }> {
    const params = new URLSearchParams({ q: query })
    return parseOutput<{ teams: TeamSearchItem[] }>(
      await fetch(`${API_CLIENT_BASE}/backoffice/team-email-limit-grants?${params.toString()}`, {
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
      await fetch(`${API_CLIENT_BASE}/backoffice/team-email-limit-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, maxEmailsPerDay, notes }),
      })
    )
  }

  async revoke(grantId: string): Promise<void> {
    await parseOutput<unknown>(
      await fetch(`${API_CLIENT_BASE}/backoffice/team-email-limit-grants/${grantId}`, {
        method: "DELETE",
      })
    )
  }

  async listSendingHealth(teamIds?: string[]): Promise<{ teams: TeamSendingHealthItem[] }> {
    // Sem `teamIds` a rota devolve todos os times fora de `healthy` — é esse
    // modo que a tela usa, para não esconder time bloqueado sem grant.
    const query =
      teamIds && teamIds.length > 0
        ? `?${new URLSearchParams({ teamIds: teamIds.join(",") }).toString()}`
        : ""
    return parseOutput<{ teams: TeamSendingHealthItem[] }>(
      await fetch(`${API_CLIENT_BASE}/backoffice/team-email-sending-health${query}`, {
        cache: "no-store",
      })
    )
  }

  async applySendingHealthAction(teamId: string, action: SendingHealthAction): Promise<void> {
    await parseOutput<unknown>(
      await fetch(`${API_CLIENT_BASE}/backoffice/team-email-sending-health/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
    )
  }
}

export const backofficeTeamEmailLimitService = new BackofficeTeamEmailLimitService()

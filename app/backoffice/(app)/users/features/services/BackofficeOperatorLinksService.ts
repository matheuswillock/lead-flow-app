import { API_CLIENT_BASE } from "@/lib/route-map"
import type {
  IBackofficeOperatorLinksService,
  OperatorAccountSummary,
  OperatorAccountTeam,
  OperatorLinkedAccount,
  OperatorLinkPayload,
} from "./IBackofficeOperatorLinksService"

const ACCOUNT_SEARCH_PAGE_SIZE = 8

export class BackofficeOperatorLinksService implements IBackofficeOperatorLinksService {
  async getLinks(userId: string): Promise<OperatorLinkedAccount[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/users/${userId}/account-links`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar contas e times")
    return data.result ?? []
  }

  async saveLinks(userId: string, links: OperatorLinkPayload[]) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/users/${userId}/account-links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    })
    return res.json()
  }

  async searchAccounts(query: string): Promise<OperatorAccountSummary[]> {
    const params = new URLSearchParams({
      q: query,
      mastersOnly: "true",
      pageSize: String(ACCOUNT_SEARCH_PAGE_SIZE),
    })
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users?${params}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar contas")
    return data.result?.items ?? []
  }

  async listAccountTeams(masterId: string): Promise<OperatorAccountTeam[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar times")
    return data.result ?? []
  }
}

import type { IBackofficeBetaService } from "./IBackofficeBetaService"
import type { BetaClientSearchResult, BetaFeatureItem, BetaGrantItem, RawBetaGrant } from "../context/BackofficeBetaTypes"

export class BackofficeBetaService implements IBackofficeBetaService {
  async listBetaFeatures(): Promise<BetaFeatureItem[]> {
    const res = await fetch("/api/v1/backoffice/features", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar funcionalidades")
    const all = (data.result ?? []) as Array<{
      id: string
      slug: string
      name: string
      betaEnabled: boolean
      grants: BetaGrantItem[]
    }>
    return all
      .filter((f) => f.betaEnabled)
      .map((f) => ({ id: f.id, slug: f.slug, name: f.name, grants: f.grants }))
  }

  async listBetaUsers(featureId: string): Promise<BetaGrantItem[]> {
    const res = await fetch(`/api/v1/backoffice/features/${featureId}/beta-users`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar usuários beta")
    return data.result ?? []
  }

  async addBetaUser(featureId: string, profileId: string): Promise<RawBetaGrant> {
    const res = await fetch(`/api/v1/backoffice/features/${featureId}/beta-users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao adicionar usuário beta")
    return data.result
  }

  async removeBetaUser(featureId: string, profileId: string): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/features/${featureId}/beta-users/${profileId}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao remover usuário beta")
  }

  async searchClients(query: string, page: number): Promise<BetaClientSearchResult> {
    const search = new URLSearchParams({ page: String(page), pageSize: "10" })
    if (query.trim()) search.set("q", query.trim())
    const res = await fetch(`/api/v1/backoffice/platform-users?${search.toString()}`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar usuários")
    return {
      items: (data.result?.items ?? []).map((c: { id: string; fullName: string | null; email: string; profileIconUrl: string | null }) => ({
        id: c.id,
        fullName: c.fullName ?? c.email,
        email: c.email,
        profileIconUrl: c.profileIconUrl,
      })),
      pagination: data.result?.pagination ?? {
        page,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
  }
}

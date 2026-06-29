import { isBetaGroupEligible } from "@/lib/features/is-beta-group-eligible"
import type { IBackofficeBetaService } from "./IBackofficeBetaService"
import type {
  AddBetaUserPayload,
  BetaClientSearchResult,
  BetaFeatureItem,
  BetaGrantItem,
  BetaGrantTeamItem,
  RawBetaGrant,
  UpdateBetaUserPayload,
} from "../context/BackofficeBetaTypes"

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
      inheritParentSettings: boolean
      grants: BetaGrantItem[]
    }>
    return all
      .filter((f) => isBetaGroupEligible(f))
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

  async addBetaUser(featureId: string, payload: AddBetaUserPayload): Promise<RawBetaGrant> {
    const res = await fetch(`/api/v1/backoffice/features/${featureId}/beta-users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao adicionar usuário beta")
    return data.result
  }

  async updateBetaUser(featureId: string, payload: UpdateBetaUserPayload): Promise<RawBetaGrant> {
    const res = await fetch(`/api/v1/backoffice/features/${featureId}/beta-users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao atualizar escopo beta")
    return data.result
  }

  async removeBetaUser(featureId: string, profileId: string): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/features/${featureId}/beta-users/${profileId}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao remover usuário beta")
  }

  async searchMasters(query: string, page: number): Promise<BetaClientSearchResult> {
    const search = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      mastersOnly: "true",
    })
    if (query.trim()) search.set("q", query.trim())
    const res = await fetch(`/api/v1/backoffice/platform-users?${search.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar masters")
    return {
      items: (data.result?.items ?? []).map(
        (c: { id: string; fullName: string | null; email: string; profileIconUrl: string | null }) => ({
          id: c.id,
          fullName: c.fullName ?? c.email,
          email: c.email,
          profileIconUrl: c.profileIconUrl,
        })
      ),
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

  async getMasterTeams(masterId: string): Promise<BetaGrantTeamItem[]> {
    const res = await fetch(`/api/v1/backoffice/platform-users/${masterId}/teams`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar times do master")
    return (data.result ?? []) as BetaGrantTeamItem[]
  }
}

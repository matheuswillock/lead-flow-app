import type {
  PublicFormDetail,
  PublicFormsIds,
  PublicFormsPage,
  PublicFormSettings,
  RankedForm,
} from "../context/PublicFormsTypes"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import type {
  IPublicFormsService,
  PublicFormAnalytics,
  PublicFormsListFilters,
} from "./IPublicFormsService"
import { API_CLIENT_BASE } from "@/lib/route-map";

type Output<T> = { isValid: boolean; result: T; errorMessages?: string[] }

class PublicFormsClientService implements IPublicFormsService {
  private headers(ids: PublicFormsIds, json = false): HeadersInit {
    return {
      "x-supabase-user-id": ids.supabaseId,
      "x-team-id": ids.teamId,
      ...(json ? { "Content-Type": "application/json" } : {}),
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    const output = (await response.json()) as Output<T>
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.join("; ") || "Não foi possível concluir a operação")
    }
    return output.result
  }

  async list(ids: PublicFormsIds, filters: PublicFormsListFilters) {
    const query = new URLSearchParams({
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    })
    if (filters.search) query.set("search", filters.search)
    if (filters.status.length) query.set("status", filters.status.join(","))
    if (filters.approvalStatus.length) query.set("approvalStatus", filters.approvalStatus.join(","))
    if (filters.assignedSdrId) query.set("assignedSdrId", filters.assignedSdrId)
    if (filters.updatedFrom) query.set("updatedFrom", filters.updatedFrom)
    if (filters.updatedTo) query.set("updatedTo", filters.updatedTo)
    return this.parse<PublicFormsPage>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms?${query}`, {
        headers: this.headers(ids),
        cache: "no-store",
      }),
    )
  }

  async get(ids: PublicFormsIds, formId: string) {
    return this.parse<PublicFormDetail>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms/${formId}`, {
        headers: this.headers(ids),
        cache: "no-store",
      }),
    )
  }

  async create(ids: PublicFormsIds, input: PublicFormDraftInput) {
    return this.parse<PublicFormDetail>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms`, {
        method: "POST",
        headers: this.headers(ids, true),
        body: JSON.stringify(input),
      }),
    )
  }

  async update(ids: PublicFormsIds, formId: string, input: PublicFormDraftInput) {
    return this.parse<PublicFormDetail>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms/${formId}`, {
        method: "PATCH",
        headers: this.headers(ids, true),
        body: JSON.stringify(input),
      }),
    )
  }

  async action(ids: PublicFormsIds, formId: string, action: string, body?: unknown) {
    return this.parse<unknown>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms/${formId}/${action}`, {
        method: "POST",
        headers: this.headers(ids, body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  }

  async getSettings(ids: PublicFormsIds) {
    return this.parse<PublicFormSettings>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-form-settings`, {
        headers: this.headers(ids),
        cache: "no-store",
      }),
    )
  }

  async saveSettings(ids: PublicFormsIds, input: PublicFormSettings) {
    return this.parse<PublicFormSettings>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-form-settings`, {
        method: "PATCH",
        headers: this.headers(ids, true),
        body: JSON.stringify(input),
      }),
    )
  }

  async analytics(
    ids: PublicFormsIds,
    formId: string,
    filters?: { from?: string; to?: string; publicationId?: string },
  ) {
    const query = new URLSearchParams()
    if (filters?.from) query.set("from", filters.from)
    if (filters?.to) query.set("to", filters.to)
    if (filters?.publicationId && filters.publicationId !== "all") {
      query.set("publicationId", filters.publicationId)
    }
    return this.parse<PublicFormAnalytics>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms/${formId}/analytics?${query}`, {
        headers: this.headers(ids),
        cache: "no-store",
      }),
    )
  }

  async topConverting(ids: PublicFormsIds) {
    return this.parse<{ items: RankedForm[] }>(
      await fetch(`${API_CLIENT_BASE}/teams/${ids.teamId}/public-forms/top-converting`, {
        headers: this.headers(ids),
        cache: "no-store",
      }),
    )
  }
}

export const publicFormsClientService = new PublicFormsClientService()

export const publicFormsService = {
  get(supabaseId: string, teamId: string, formId: string) {
    return publicFormsClientService.get({ supabaseId, teamId }, formId)
  },
  save(supabaseId: string, teamId: string, formId: string | null, input: PublicFormDraftInput) {
    const ids = { supabaseId, teamId }
    return formId
      ? publicFormsClientService.update(ids, formId, input)
      : publicFormsClientService.create(ids, input)
  },
  action(supabaseId: string, teamId: string, formId: string, action: string, body?: unknown) {
    return publicFormsClientService.action({ supabaseId, teamId }, formId, action, body)
  },
}

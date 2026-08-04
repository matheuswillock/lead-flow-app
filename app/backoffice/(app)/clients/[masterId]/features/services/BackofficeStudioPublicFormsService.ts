import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import type {
  IBackofficeStudioPublicFormsService,
  StudioPublicFormAnalytics,
  StudioPublicFormDetail,
  StudioPublicFormSettings,
  StudioPublicFormsListFilters,
  StudioPublicFormsPage,
  StudioPublicFormWizardContext,
} from "./IBackofficeStudioPublicFormsService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface ApiOutput<T> {
  isValid: boolean
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiOutput<T> | null
  if (!response.ok || !json?.isValid) {
    throw new Error(json?.errorMessages?.[0] ?? `HTTP ${response.status}`)
  }
  return json.result
}

function basePath(masterId: string, teamId: string) {
  return `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/teams/${teamId}`
}

export class BackofficeStudioPublicFormsService implements IBackofficeStudioPublicFormsService {
  async list(
    masterId: string,
    teamId: string,
    filters: StudioPublicFormsListFilters = {}
  ): Promise<StudioPublicFormsPage> {
    const query = new URLSearchParams({
      page: String(filters.page ?? 1),
      pageSize: String(filters.pageSize ?? 20),
    })
    if (filters.search) query.set("search", filters.search)
    if (filters.status?.length) query.set("status", filters.status.join(","))
    if (filters.approvalStatus?.length) {
      query.set("approvalStatus", filters.approvalStatus.join(","))
    }
    const response = await fetch(
      `${basePath(masterId, teamId)}/public-forms?${query}`,
      { cache: "no-store" }
    )
    return parseOutput(response)
  }

  async get(masterId: string, teamId: string, formId: string): Promise<StudioPublicFormDetail> {
    const response = await fetch(`${basePath(masterId, teamId)}/public-forms/${formId}`, {
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async create(
    masterId: string,
    teamId: string,
    input: PublicFormDraftInput
  ): Promise<StudioPublicFormDetail> {
    const response = await fetch(`${basePath(masterId, teamId)}/public-forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return parseOutput(response)
  }

  async update(
    masterId: string,
    teamId: string,
    formId: string,
    input: PublicFormDraftInput
  ): Promise<StudioPublicFormDetail> {
    const response = await fetch(`${basePath(masterId, teamId)}/public-forms/${formId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return parseOutput(response)
  }

  async action(
    masterId: string,
    teamId: string,
    formId: string,
    action: string,
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/public-forms/${formId}/${action}`,
      {
        method: "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }
    )
    return parseOutput(response)
  }

  async getSettings(masterId: string, teamId: string): Promise<StudioPublicFormSettings> {
    const response = await fetch(`${basePath(masterId, teamId)}/public-form-settings`, {
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async saveSettings(
    masterId: string,
    teamId: string,
    input: StudioPublicFormSettings
  ): Promise<StudioPublicFormSettings> {
    const response = await fetch(`${basePath(masterId, teamId)}/public-form-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return parseOutput(response)
  }

  async analytics(
    masterId: string,
    teamId: string,
    formId: string,
    filters?: { from?: string; to?: string; publicationId?: string }
  ): Promise<StudioPublicFormAnalytics> {
    const query = new URLSearchParams()
    if (filters?.from) query.set("from", filters.from)
    if (filters?.to) query.set("to", filters.to)
    if (filters?.publicationId && filters.publicationId !== "all") {
      query.set("publicationId", filters.publicationId)
    }
    const response = await fetch(
      `${basePath(masterId, teamId)}/public-forms/${formId}/analytics?${query}`,
      { cache: "no-store" }
    )
    return parseOutput(response)
  }

  async getWizardContext(
    masterId: string,
    teamId: string
  ): Promise<StudioPublicFormWizardContext> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/public-forms/wizard-context`,
      { cache: "no-store" }
    )
    return parseOutput(response)
  }
}

export const backofficeStudioPublicFormsService = new BackofficeStudioPublicFormsService()

import { API_CLIENT_BASE } from "@/lib/route-map"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import type {
  BackofficeFormTemplateDetail,
  BackofficeFormTemplateListItem,
  BackofficeFormTemplateWizardContext,
  IBackofficeFormTemplatesService,
} from "./IBackofficeFormTemplatesService"

async function parseOutput<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!data.isValid) {
    throw new Error(data.errorMessages?.[0] ?? "Erro na requisição")
  }
  return data.result as T
}

export class BackofficeFormTemplatesService implements IBackofficeFormTemplatesService {
  async list(includeInactive = true): Promise<BackofficeFormTemplateListItem[]> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/public-form-templates?includeInactive=${includeInactive ? "true" : "false"}`,
      { cache: "no-store" },
    )
    return parseOutput(response)
  }

  async get(templateId: string): Promise<BackofficeFormTemplateDetail> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/public-form-templates/${templateId}`, {
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async create(input: {
    slug: string
    name: string
    description?: string | null
    formKind?: string
    sortOrder?: number
    draft: PublicFormDraftInput
  }): Promise<BackofficeFormTemplateDetail> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/public-form-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return parseOutput(response)
  }

  async update(
    templateId: string,
    input: {
      name?: string
      description?: string | null
      formKind?: string
      sortOrder?: number
      draft?: PublicFormDraftInput
    },
  ): Promise<BackofficeFormTemplateDetail> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/public-form-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return parseOutput(response)
  }

  async publish(templateId: string): Promise<BackofficeFormTemplateDetail> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/public-form-templates/${templateId}/publish`,
      { method: "POST" },
    )
    return parseOutput(response)
  }

  async unpublish(templateId: string): Promise<BackofficeFormTemplateDetail> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/public-form-templates/${templateId}/unpublish`,
      { method: "POST" },
    )
    return parseOutput(response)
  }

  async getWizardContext(): Promise<BackofficeFormTemplateWizardContext> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/public-form-templates/wizard-context`, {
      cache: "no-store",
    })
    return parseOutput(response)
  }
}

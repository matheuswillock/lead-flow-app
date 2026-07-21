import type {
  BackofficeEmailCampaignDispatchItem,
  BackofficeEmailCampaignItem,
  BackofficeEmailContactListOption,
  BackofficeEmailTemplateOption,
  CreateBackofficeEmailCampaignFormData,
} from "../context/BackofficeEmailCampaignsTypes"
import type { IBackofficeEmailCampaignsService } from "./IBackofficeEmailCampaignsService"

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

export class BackofficeEmailCampaignsService implements IBackofficeEmailCampaignsService {
  async listCampaigns(): Promise<BackofficeEmailCampaignItem[]> {
    const response = await fetch("/api/v1/backoffice/email-campaigns", {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput<BackofficeEmailCampaignItem[]>(response)
  }

  async createCampaign(
    data: CreateBackofficeEmailCampaignFormData
  ): Promise<BackofficeEmailCampaignItem> {
    const response = await fetch("/api/v1/backoffice/email-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput<BackofficeEmailCampaignItem>(response)
  }

  async updateCampaign(
    id: string,
    data: Partial<CreateBackofficeEmailCampaignFormData>
  ): Promise<BackofficeEmailCampaignItem> {
    const response = await fetch(`/api/v1/backoffice/email-campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput<BackofficeEmailCampaignItem>(response)
  }

  async cancelCampaign(id: string): Promise<BackofficeEmailCampaignItem> {
    const response = await fetch(`/api/v1/backoffice/email-campaigns/${id}`, {
      method: "DELETE",
    })
    return parseOutput<BackofficeEmailCampaignItem>(response)
  }

  async sendNow(id: string): Promise<BackofficeEmailCampaignItem> {
    const response = await fetch(`/api/v1/backoffice/email-campaigns/${id}/send-now`, {
      method: "POST",
    })
    return parseOutput<BackofficeEmailCampaignItem>(response)
  }

  async listDispatches(id: string): Promise<BackofficeEmailCampaignDispatchItem[]> {
    const response = await fetch(`/api/v1/backoffice/email-campaigns/${id}/dispatches`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput<BackofficeEmailCampaignDispatchItem[]>(response)
  }

  async listContactLists(): Promise<BackofficeEmailContactListOption[]> {
    const response = await fetch("/api/v1/backoffice/email-campaigns/contact-lists", {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput<BackofficeEmailContactListOption[]>(response)
  }

  async listTemplates(): Promise<BackofficeEmailTemplateOption[]> {
    const response = await fetch("/api/v1/backoffice/email-templates", {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput<BackofficeEmailTemplateOption[]>(response)
  }
}

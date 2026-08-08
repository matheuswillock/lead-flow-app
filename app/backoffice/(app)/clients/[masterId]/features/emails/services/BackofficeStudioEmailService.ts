import type {
  CreateStudioEmailCampaignData,
  CreateStudioEmailTemplateData,
  IBackofficeStudioEmailService,
  PaginatedContactsResult,
  PaginatedResult,
  StudioEmailAnalytics,
  StudioEmailCampaign,
  StudioEmailCampaignLog,
  StudioEmailContact,
  StudioEmailContactImportEnqueueResult,
  StudioEmailContactImportRow,
  StudioEmailContactList,
  StudioEmailDomain,
  StudioEmailDomainConnectResult,
  StudioEmailLog,
  StudioEmailLogDetail,
  StudioEmailResendDomainStatus,
  StudioEmailSendCampaignResult,
  StudioEmailSender,
  StudioEmailSettings,
  StudioEmailTemplate,
  StudioEmailTemplateTestData,
  StudioEmailTemplateVersion,
  StudioEmailVariable,
  UpdateStudioEmailCampaignData,
  UpdateStudioEmailSettingsData,
  UpdateStudioEmailTemplateData,
  UpsertStudioEmailSenderData,
  UpsertStudioEmailVariableData,
} from "./IBackofficeStudioEmailService"

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

function basePath(masterId: string, teamId: string) {
  return `/api/v1/backoffice/platform-users/${masterId}/teams/${teamId}/email`
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

function buildQuery(params?: Record<string, string | number | string[] | undefined | null>): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(","))
      continue
    }
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export class BackofficeStudioEmailService implements IBackofficeStudioEmailService {
  async listCampaigns(
    masterId: string,
    teamId: string,
    params?: {
      page?: number
      pageSize?: number
      name?: string
      status?: string[]
      createdAtFrom?: string
      createdAtTo?: string
    }
  ): Promise<{ campaigns: StudioEmailCampaign[]; total: number; page?: number; pageSize?: number; totalPages?: number }> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/campaigns${buildQuery({
        page: params?.page,
        pageSize: params?.pageSize,
        name: params?.name,
        status: params?.status,
        createdAtFrom: params?.createdAtFrom,
        createdAtTo: params?.createdAtTo,
      })}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async getCampaign(masterId: string, teamId: string, campaignId: string): Promise<StudioEmailCampaign> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns/${campaignId}`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createCampaign(
    masterId: string,
    teamId: string,
    data: CreateStudioEmailCampaignData
  ): Promise<StudioEmailCampaign> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async updateCampaign(
    masterId: string,
    teamId: string,
    campaignId: string,
    data: UpdateStudioEmailCampaignData
  ): Promise<StudioEmailCampaign> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async sendCampaign(
    masterId: string,
    teamId: string,
    campaignId: string
  ): Promise<StudioEmailSendCampaignResult> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns/${campaignId}/send`, {
      method: "POST",
    })
    return parseOutput(response)
  }

  async cancelCampaign(masterId: string, teamId: string, campaignId: string): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns/${campaignId}/cancel`, {
      method: "POST",
    })
    await parseOutput(response)
  }

  async archiveCampaign(masterId: string, teamId: string, campaignId: string): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/campaigns/${campaignId}/archive`, {
      method: "POST",
    })
    await parseOutput(response)
  }

  async getCampaignLogs(
    masterId: string,
    teamId: string,
    campaignId: string,
    params: { page: number; pageSize: number; search?: string; status?: string[] }
  ): Promise<PaginatedResult<StudioEmailCampaignLog>> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/logs${buildQuery({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        status: params.status,
        campaignId,
      })}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async getCampaignLogDetail(
    masterId: string,
    teamId: string,
    logId: string
  ): Promise<StudioEmailLogDetail> {
    return this.getLog(masterId, teamId, logId)
  }

  async getCampaignAnalytics(
    masterId: string,
    teamId: string,
    params: { from: string; to: string; campaignId: string }
  ): Promise<StudioEmailAnalytics> {
    return this.getAnalytics(masterId, teamId, params)
  }

  async listContactLists(masterId: string, teamId: string): Promise<StudioEmailContactList[]> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async getContactList(
    masterId: string,
    teamId: string,
    listId: string
  ): Promise<StudioEmailContactList> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists/${listId}`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createContactList(
    masterId: string,
    teamId: string,
    data: { name: string; description?: string }
  ): Promise<StudioEmailContactList> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async updateContactList(
    masterId: string,
    teamId: string,
    listId: string,
    data: { name?: string; description?: string }
  ): Promise<StudioEmailContactList> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async deleteContactList(masterId: string, teamId: string, listId: string): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists/${listId}`, {
      method: "DELETE",
    })
    await parseOutput(response)
  }

  async listContacts(
    masterId: string,
    teamId: string,
    listId: string,
    params?: { page?: number; pageSize?: number; search?: string }
  ): Promise<PaginatedContactsResult<StudioEmailContact>> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/contact-lists/${listId}/contacts${buildQuery({
        page: params?.page,
        pageSize: params?.pageSize,
        search: params?.search,
      })}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async addContact(
    masterId: string,
    teamId: string,
    listId: string,
    data: { email: string; name?: string | null }
  ): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists/${listId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    await parseOutput(response)
  }

  async deleteContact(
    masterId: string,
    teamId: string,
    listId: string,
    contactId: string
  ): Promise<void> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/contact-lists/${listId}/contacts/${contactId}`,
      { method: "DELETE" }
    )
    await parseOutput(response)
  }

  async uploadContacts(
    masterId: string,
    teamId: string,
    listId: string,
    file: File
  ): Promise<StudioEmailContactImportEnqueueResult> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`${basePath(masterId, teamId)}/contact-lists/${listId}/upload`, {
      method: "POST",
      body: formData,
    })
    return parseOutput(response)
  }

  async importMappedContacts(
    masterId: string,
    teamId: string,
    listId: string,
    rows: StudioEmailContactImportRow[]
  ): Promise<StudioEmailContactImportEnqueueResult> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/contact-lists/${listId}/import/mapped`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      }
    )
    return parseOutput(response)
  }

  async listTemplates(
    masterId: string,
    teamId: string,
    params?: {
      scope?: "campaign" | "workbench"
      approvalFilter?: "all" | "pending_approval" | "approved" | "rejected"
    }
  ): Promise<StudioEmailTemplate[]> {
    const query: Record<string, string | undefined> = {}
    if (params?.scope) query.scope = params.scope
    if (params?.approvalFilter) query.approvalFilter = params.approvalFilter
    const response = await fetch(
      `${basePath(masterId, teamId)}/templates${buildQuery(query)}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async getTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createTemplate(
    masterId: string,
    teamId: string,
    data: CreateStudioEmailTemplateData
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async updateTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    data: UpdateStudioEmailTemplateData
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async publishTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/publish`, {
      method: "POST",
    })
    return parseOutput(response)
  }

  async unpublishTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/publish`, {
      method: "DELETE",
    })
    return parseOutput(response)
  }

  async submitTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/submit`, {
      method: "POST",
    })
    return parseOutput(response)
  }

  async approveTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/approve`, {
      method: "POST",
    })
    return parseOutput(response)
  }

  async rejectTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    reviewNote: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote }),
    })
    return parseOutput(response)
  }

  async testTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    data: StudioEmailTemplateTestData
  ): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    await parseOutput(response)
  }

  async listTemplateVersions(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<{ versions: StudioEmailTemplateVersion[] }> {
    const response = await fetch(`${basePath(masterId, teamId)}/templates/${templateId}/versions`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async restoreTemplateVersion(
    masterId: string,
    teamId: string,
    templateId: string,
    versionId: string
  ): Promise<StudioEmailTemplate> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/templates/${templateId}/restore-version`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      }
    )
    return parseOutput(response)
  }

  async listLogs(
    masterId: string,
    teamId: string,
    params?: {
      page?: number
      pageSize?: number
      search?: string
      status?: string[]
      category?: string
      campaignId?: string
      from?: string
      to?: string
    }
  ): Promise<PaginatedResult<StudioEmailLog>> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/logs${buildQuery({
        page: params?.page,
        pageSize: params?.pageSize,
        search: params?.search,
        status: params?.status,
        category: params?.category,
        campaignId: params?.campaignId,
        from: params?.from,
        to: params?.to,
      })}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }

  async getLog(masterId: string, teamId: string, logId: string): Promise<StudioEmailLogDetail> {
    const response = await fetch(`${basePath(masterId, teamId)}/logs/${logId}`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async getSettings(masterId: string, teamId: string): Promise<StudioEmailSettings> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async updateSettings(
    masterId: string,
    teamId: string,
    data: UpdateStudioEmailSettingsData
  ): Promise<StudioEmailSettings> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async listSenders(masterId: string, teamId: string): Promise<StudioEmailSender[]> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/senders`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createSender(
    masterId: string,
    teamId: string,
    data: UpsertStudioEmailSenderData
  ): Promise<StudioEmailSender> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/senders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async updateSender(
    masterId: string,
    teamId: string,
    senderId: string,
    data: UpsertStudioEmailSenderData
  ): Promise<StudioEmailSender> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/senders/${senderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async deleteSender(masterId: string, teamId: string, senderId: string): Promise<void> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/senders/${senderId}`, {
      method: "DELETE",
    })
    await parseOutput(response)
  }

  async setDefaultSender(
    masterId: string,
    teamId: string,
    senderId: string
  ): Promise<StudioEmailSettings> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/settings/senders/${senderId}/default`,
      { method: "POST" }
    )
    return parseOutput(response)
  }

  async getDomain(masterId: string, teamId: string): Promise<StudioEmailDomain | null> {
    try {
      const result = await this.getDomainRecords(masterId, teamId)
      const { records: _records, events: _events, ...domain } = result
      return domain
    } catch {
      return null
    }
  }

  async setDomain(
    masterId: string,
    teamId: string,
    domainName: string
  ): Promise<StudioEmailDomainConnectResult> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainName }),
    })
    return parseOutput(response)
  }

  async verifyDomain(
    masterId: string,
    teamId: string
  ): Promise<{ status: StudioEmailResendDomainStatus }> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/domain/verify`, {
      method: "POST",
    })
    return parseOutput(response)
  }

  async getDomainRecords(
    masterId: string,
    teamId: string
  ): Promise<StudioEmailDomainConnectResult> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/domain/records`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async configureDomainTracking(
    masterId: string,
    teamId: string,
    data: {
      trackingSubdomain: string
      openTracking: boolean
      clickTracking: boolean
    }
  ): Promise<StudioEmailDomainConnectResult> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/domain/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async listVariables(masterId: string, teamId: string): Promise<StudioEmailVariable[]> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/variables`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput(response)
  }

  async createVariable(
    masterId: string,
    teamId: string,
    data: UpsertStudioEmailVariableData
  ): Promise<StudioEmailVariable> {
    const response = await fetch(`${basePath(masterId, teamId)}/settings/variables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseOutput(response)
  }

  async updateVariable(
    masterId: string,
    teamId: string,
    variableId: string,
    data: UpsertStudioEmailVariableData
  ): Promise<StudioEmailVariable> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/settings/variables/${variableId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    )
    return parseOutput(response)
  }

  async deleteVariable(masterId: string, teamId: string, variableId: string): Promise<void> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/settings/variables/${variableId}`,
      { method: "DELETE" }
    )
    await parseOutput(response)
  }

  async getAnalytics(
    masterId: string,
    teamId: string,
    params?: { from?: string; to?: string; campaignId?: string }
  ): Promise<StudioEmailAnalytics> {
    const response = await fetch(
      `${basePath(masterId, teamId)}/analytics${buildQuery({
        from: params?.from,
        to: params?.to,
        campaignId: params?.campaignId,
      })}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput(response)
  }
}

export const backofficeStudioEmailService = new BackofficeStudioEmailService()

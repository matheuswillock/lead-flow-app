import type {
  DomainConnectResult,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  ResendDomainStatus,
} from "@/app/[supabaseId]/email/configuracoes/features/context/EmailSettingsTypes"
import type {
  IEmailSettingsService,
  UpdateEmailSettingsData,
  UpsertEmailSenderData,
  UpsertEmailVariableData,
} from "@/app/[supabaseId]/email/configuracoes/features/services/IEmailSettingsService"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeEmailSettingsService implements IEmailSettingsService {
  constructor(
    private readonly masterId: string,
    private readonly teamId: string
  ) {}

  private base(): string {
    return `${studioEmailBasePath(this.masterId, this.teamId)}/settings`
  }

  async get(): Promise<EmailSettings> {
    const response = await fetch(this.base())
    return parseStudioEmailOutput<EmailSettings>(response)
  }

  async update(data: UpdateEmailSettingsData): Promise<EmailSettings> {
    const response = await fetch(this.base(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<EmailSettings>(response)
  }

  async getSenders(): Promise<EmailSender[]> {
    const response = await fetch(`${this.base()}/senders`)
    return parseStudioEmailOutput<EmailSender[]>(response)
  }

  async createSender(data: UpsertEmailSenderData): Promise<EmailSender> {
    const response = await fetch(`${this.base()}/senders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<EmailSender>(response)
  }

  async updateSender(senderId: string, data: UpsertEmailSenderData): Promise<EmailSender> {
    const response = await fetch(`${this.base()}/senders/${senderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<EmailSender>(response)
  }

  async deleteSender(senderId: string): Promise<void> {
    const response = await fetch(`${this.base()}/senders/${senderId}`, { method: "DELETE" })
    await parseStudioEmailOutput<unknown>(response)
  }

  async setDefaultSender(senderId: string): Promise<EmailSettings> {
    const response = await fetch(`${this.base()}/senders/${senderId}/default`, {
      method: "POST",
    })
    return parseStudioEmailOutput<EmailSettings>(response)
  }

  async connectDomain(domainName: string): Promise<DomainConnectResult> {
    const response = await fetch(`${this.base()}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainName }),
    })
    return parseStudioEmailOutput<DomainConnectResult>(response)
  }

  async disconnectDomain(): Promise<void> {
    const response = await fetch(`${this.base()}/domain`, { method: "DELETE" })
    await parseStudioEmailOutput<unknown>(response)
  }

  async verifyDomain(): Promise<{ status: ResendDomainStatus }> {
    const response = await fetch(`${this.base()}/domain/verify`, { method: "POST" })
    return parseStudioEmailOutput<{ status: ResendDomainStatus }>(response)
  }

  async getDomainRecords(): Promise<DomainConnectResult> {
    const response = await fetch(`${this.base()}/domain/records`)
    return parseStudioEmailOutput<DomainConnectResult>(response)
  }

  async getVariables(): Promise<EmailGlobalVariable[]> {
    const response = await fetch(`${this.base()}/variables`)
    return parseStudioEmailOutput<EmailGlobalVariable[]>(response)
  }

  async createVariable(data: UpsertEmailVariableData): Promise<EmailGlobalVariable> {
    const response = await fetch(`${this.base()}/variables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<EmailGlobalVariable>(response)
  }

  async updateVariable(
    variableId: string,
    data: UpsertEmailVariableData
  ): Promise<EmailGlobalVariable> {
    const response = await fetch(`${this.base()}/variables/${variableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<EmailGlobalVariable>(response)
  }

  async deleteVariable(variableId: string): Promise<void> {
    const response = await fetch(`${this.base()}/variables/${variableId}`, {
      method: "DELETE",
    })
    await parseStudioEmailOutput<unknown>(response)
  }
}

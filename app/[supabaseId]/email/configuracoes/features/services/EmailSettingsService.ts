import type { IEmailSettingsService, UpdateEmailSettingsData, DomainConnectResult, ResendDomainStatus } from "./IEmailSettingsService"
import type { EmailSettings } from "../context/EmailSettingsTypes"

export class EmailSettingsService implements IEmailSettingsService {
  private readonly base = "/api/v1/email/settings"

  async get(): Promise<EmailSettings> {
    const res = await fetch(this.base)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro")
    return json.result as EmailSettings
  }

  async update(data: UpdateEmailSettingsData): Promise<EmailSettings> {
    const res = await fetch(this.base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro")
    return json.result as EmailSettings
  }

  async connectDomain(domainName: string): Promise<DomainConnectResult> {
    const res = await fetch(`${this.base}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainName }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro ao conectar domínio")
    return json.result as DomainConnectResult
  }

  async disconnectDomain(): Promise<void> {
    const res = await fetch(`${this.base}/domain`, { method: "DELETE" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro ao desconectar domínio")
  }

  async verifyDomain(): Promise<{ status: ResendDomainStatus }> {
    const res = await fetch(`${this.base}/domain/verify`, { method: "POST" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro ao verificar domínio")
    return json.result as { status: ResendDomainStatus }
  }

  async getDomainRecords(): Promise<DomainConnectResult> {
    const res = await fetch(`${this.base}/domain/records`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro ao buscar registros DNS")
    return json.result as DomainConnectResult
  }
}

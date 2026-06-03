import type { IBackofficeEmailSettingsService, UpdateEmailSettingsData } from "./IBackofficeEmailSettingsService"
import type { BackofficeEmailSettingsListResult, BackofficeTeamEmailEntry, EmailSettings } from "../context/BackofficeEmailSettingsTypes"

export class BackofficeEmailSettingsService implements IBackofficeEmailSettingsService {
  private readonly base = "/api/v1/backoffice/email-settings"

  async list(options: { search?: string; page: number; pageSize: number }): Promise<BackofficeEmailSettingsListResult> {
    const params = new URLSearchParams({
      page: String(options.page),
      pageSize: String(options.pageSize),
    })
    if (options.search) params.set("search", options.search)
    const res = await fetch(`${this.base}?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro")
    return json.result as BackofficeEmailSettingsListResult
  }

  async getByTeamId(teamId: string): Promise<BackofficeTeamEmailEntry> {
    const res = await fetch(`${this.base}/${teamId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro")
    return json.result as BackofficeTeamEmailEntry
  }

  async update(teamId: string, data: UpdateEmailSettingsData): Promise<EmailSettings> {
    const res = await fetch(`${this.base}/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro")
    return json.result as EmailSettings
  }
}

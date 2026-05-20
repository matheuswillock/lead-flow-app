import type { IEmailSettingsService, EmailSettings, UpdateEmailSettingsData } from "./IEmailSettingsService"

export class EmailSettingsService implements IEmailSettingsService {
  private readonly baseUrl = "/api/v1/email/settings"

  async get(): Promise<EmailSettings> {
    const res = await fetch(this.baseUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro")
    return json.result as EmailSettings
  }

  async update(data: UpdateEmailSettingsData): Promise<EmailSettings> {
    const res = await fetch(this.baseUrl, {
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

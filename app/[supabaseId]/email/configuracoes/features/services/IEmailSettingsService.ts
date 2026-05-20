export interface EmailSettings {
  fromName: string
  fromEmail: string
  replyTo: string | null
}

export interface UpdateEmailSettingsData {
  fromName?: string
  fromEmail?: string
  replyTo?: string | null
}

export interface IEmailSettingsService {
  get(): Promise<EmailSettings>
  update(data: UpdateEmailSettingsData): Promise<EmailSettings>
}

import type { BackofficeEmailSettingsListResult, BackofficeTeamEmailEntry, EmailSettings } from "../context/BackofficeEmailSettingsTypes"
import type { UpdateEmailSettingsData } from "@/app/[supabaseId]/email/configuracoes/features/services/IEmailSettingsService"

export type { UpdateEmailSettingsData }

export interface IBackofficeEmailSettingsService {
  list(options: { search?: string; page: number; pageSize: number }): Promise<BackofficeEmailSettingsListResult>
  getByTeamId(teamId: string): Promise<BackofficeTeamEmailEntry>
  update(teamId: string, data: UpdateEmailSettingsData): Promise<EmailSettings>
}

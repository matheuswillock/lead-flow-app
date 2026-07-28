import type { WhatsAppConfig, WhatsAppUsage, ReusableWhatsAppNumber, WhatsAppOpsMetrics } from '../context/WhatsAppSettingsTypes'

export interface IWhatsAppSettingsService {
  fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null>
  fetchReusableNumbers(teamId: string, supabaseId: string): Promise<ReusableWhatsAppNumber[]>
  createConfig(
    teamId: string,
    supabaseId: string,
    options?: { reuseFromTeamId?: string }
  ): Promise<WhatsAppConfig>
  reconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  disconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  fetchUsage(teamId: string, supabaseId: string): Promise<WhatsAppUsage | null>
  fetchOpsMetrics(teamId: string, supabaseId: string): Promise<WhatsAppOpsMetrics>
  syncHistory(teamId: string, supabaseId: string): Promise<void>
  syncPhoneContacts(
    teamId: string,
    supabaseId: string
  ): Promise<{ imported: number; updatedConversations: number; totalContacts: number }>
}

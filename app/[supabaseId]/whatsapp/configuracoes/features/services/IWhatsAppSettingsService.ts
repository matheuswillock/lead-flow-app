import type { WhatsAppConfig, WhatsAppUsage } from '../context/WhatsAppSettingsTypes'

export interface IWhatsAppSettingsService {
  fetchConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig | null>
  createConfig(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  reconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  disconnect(teamId: string, supabaseId: string): Promise<WhatsAppConfig>
  fetchUsage(teamId: string, supabaseId: string): Promise<WhatsAppUsage | null>
}

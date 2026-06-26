import type {
  OffHoursSchedule,
  WhatsAppAutoResponseMatchMode,
  WhatsAppAutoResponseRule,
} from '../context/WhatsAppAutoResponsesTypes'

export interface IWhatsAppAutoResponsesService {
  fetchRules(teamId: string, supabaseId: string): Promise<WhatsAppAutoResponseRule[]>
  updateRule(
    teamId: string,
    supabaseId: string,
    ruleId: string,
    payload: Partial<{
      replyMessage: string
      triggerKeywords: string[]
      matchMode: WhatsAppAutoResponseMatchMode
      offHoursSchedule: OffHoursSchedule | null
      isActive: boolean
      priority: number
    }>
  ): Promise<WhatsAppAutoResponseRule>
  toggleRule(
    teamId: string,
    supabaseId: string,
    ruleId: string,
    isActive: boolean
  ): Promise<WhatsAppAutoResponseRule>
}

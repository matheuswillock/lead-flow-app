export type WhatsAppAutoResponseRuleType = 'WELCOME' | 'OFF_HOURS' | 'KEYWORD'
export type WhatsAppAutoResponseMatchMode = 'CONTAINS' | 'EXACT' | 'STARTS_WITH'

export type OffHoursTimeRange = {
  start: string
  end: string
}

export type OffHoursSchedule = {
  timezone?: string
  days?: Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', OffHoursTimeRange[]>>
  holidays?: string[]
}

export interface WhatsAppAutoResponseRule {
  id: string
  configId: string
  type: WhatsAppAutoResponseRuleType
  replyMessage: string
  triggerKeywords: string[]
  matchMode: WhatsAppAutoResponseMatchMode
  offHoursSchedule: OffHoursSchedule | null
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface WhatsAppAutoResponsesContextValue {
  rules: WhatsAppAutoResponseRule[]
  isLoading: boolean
  isSaving: boolean
  activeTeamId: string | null
  loadRules: () => Promise<void>
  updateRule: (
    ruleId: string,
    payload: Partial<{
      replyMessage: string
      triggerKeywords: string[]
      matchMode: WhatsAppAutoResponseMatchMode
      offHoursSchedule: OffHoursSchedule | null
      isActive: boolean
      priority: number
    }>
  ) => Promise<void>
  toggleRule: (ruleId: string, isActive: boolean) => Promise<void>
}

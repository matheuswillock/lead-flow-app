import type {
  WhatsAppAutoResponseMatchMode,
  WhatsAppAutoResponseRuleType,
} from "@prisma/client"
import type { WhatsAppAutoResponseRuleSelect } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppAutoResponseRepository"
import { isOffHours, type OffHoursSchedule } from "@/lib/whatsapp/off-hours-schedule"

const MATCH_MODE_RANK: Record<WhatsAppAutoResponseMatchMode, number> = {
  EXACT: 3,
  STARTS_WITH: 2,
  CONTAINS: 1,
}

function matchesKeyword(text: string, rule: WhatsAppAutoResponseRuleSelect): boolean {
  const normalizedText = text.trim().toLowerCase()
  if (!normalizedText) return false

  for (const keyword of rule.triggerKeywords) {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) continue

    if (rule.matchMode === "EXACT" && normalizedText === normalizedKeyword) return true
    if (rule.matchMode === "STARTS_WITH" && normalizedText.startsWith(normalizedKeyword)) return true
    if (rule.matchMode === "CONTAINS" && normalizedText.includes(normalizedKeyword)) return true
  }

  return false
}

function pickKeywordRule(
  text: string,
  rules: WhatsAppAutoResponseRuleSelect[]
): WhatsAppAutoResponseRuleSelect | null {
  const keywordRules = rules.filter((rule) => rule.type === "KEYWORD")
  const matches = keywordRules.filter((rule) => matchesKeyword(text, rule))
  if (matches.length === 0) return null

  return matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return MATCH_MODE_RANK[b.matchMode] - MATCH_MODE_RANK[a.matchMode]
  })[0] ?? null
}

export function pickAutoResponseRule(params: {
  rules: WhatsAppAutoResponseRuleSelect[]
  inboundText: string
  teamTimezone: string
  skipRuleTypes: Set<WhatsAppAutoResponseRuleType>
}): WhatsAppAutoResponseRuleSelect | null {
  const { rules, inboundText, teamTimezone, skipRuleTypes } = params
  const text = inboundText.trim()
  if (!text) return null

  if (!skipRuleTypes.has("KEYWORD")) {
    const keywordRule = pickKeywordRule(text, rules)
    if (keywordRule) return keywordRule
  }

  const offHoursRule = rules.find((rule) => rule.type === "OFF_HOURS")
  if (offHoursRule && !skipRuleTypes.has("OFF_HOURS")) {
    const schedule = offHoursRule.offHoursSchedule as OffHoursSchedule | null
    if (isOffHours(schedule, new Date(), teamTimezone)) {
      return offHoursRule
    }
  }

  const welcomeRule = rules.find((rule) => rule.type === "WELCOME")
  if (welcomeRule && !skipRuleTypes.has("WELCOME")) {
    return welcomeRule
  }

  return null
}

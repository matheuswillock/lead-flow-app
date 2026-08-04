import type { PublicFormMetricType } from "@prisma/client"

/** `RadarEvent.sourceType` para métricas espelhadas de formulário público (D8). */
export const PUBLIC_FORM_RADAR_SOURCE_TYPE = "public_form" as const

/**
 * Tipos que historicamente preferem identidade `lead_id` (pós-conversão).
 * Com atribuição de campanha, qualquer evento com `leadId` resolve via lead.
 */
export const PUBLIC_FORM_LEAD_RESOLVED_METRIC_TYPES = new Set<PublicFormMetricType>([
  "form_viewed",
  "form_started",
  "form_completed",
  "lead_created",
  "lead_attached",
])

const PUBLIC_FORM_METRIC_TO_RADAR_EVENT_TYPE: Record<PublicFormMetricType, string> = {
  form_viewed: "form.viewed",
  form_started: "form.started",
  question_viewed: "form.question_viewed",
  question_answered: "form.question_answered",
  question_skipped: "form.question_skipped",
  form_completed: "form.completed",
  lead_created: "form.lead_created",
  lead_attached: "form.lead_attached",
  meeting_scheduled: "form.meeting_scheduled",
}

export function mapPublicFormMetricToRadarEventType(
  eventType: PublicFormMetricType | string
): string | null {
  if (eventType in PUBLIC_FORM_METRIC_TO_RADAR_EVENT_TYPE) {
    return PUBLIC_FORM_METRIC_TO_RADAR_EVENT_TYPE[eventType as PublicFormMetricType]
  }
  return null
}

export function isPublicFormLeadResolvedMetricType(
  eventType: PublicFormMetricType | string
): boolean {
  return PUBLIC_FORM_LEAD_RESOLVED_METRIC_TYPES.has(eventType as PublicFormMetricType)
}

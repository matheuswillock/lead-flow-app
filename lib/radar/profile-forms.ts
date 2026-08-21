export const RADAR_PROFILE_FORM_COMPLETION = {
  complete: "complete",
  incomplete: "incomplete",
  startedWithoutAnswers: "started_without_answers",
} as const

export type RadarProfileFormCompletionStatus =
  (typeof RADAR_PROFILE_FORM_COMPLETION)[keyof typeof RADAR_PROFILE_FORM_COMPLETION]

export type RadarProfileFormItem = {
  formId: string
  publicId: string | null
  name: string
  completionStatus: RadarProfileFormCompletionStatus
  firstInteractionAt: string
  lastInteractionAt: string
  answeredQuestionCount: number
}

export type RadarProfileForms = {
  items: RadarProfileFormItem[]
}

export type RadarProfileFormEventMarker = {
  eventType: string
  occurredAt: Date
  metadata: unknown
}

export type RadarProfileFormCatalogItem = {
  id: string
  name: string
  publicId: string
}

export function formIdFromRadarEventMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const formId = (metadata as Record<string, unknown>).formId
  return typeof formId === "string" && formId.length > 0 ? formId : null
}

export function questionIdFromRadarEventMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const questionId = (metadata as Record<string, unknown>).questionId
  return typeof questionId === "string" && questionId.length > 0 ? questionId : null
}

export function resolveRadarProfileFormCompletion(
  eventTypes: Iterable<string>,
): RadarProfileFormCompletionStatus {
  const types = eventTypes instanceof Set ? eventTypes : new Set(eventTypes)
  if (types.has("form.completed")) return RADAR_PROFILE_FORM_COMPLETION.complete
  if (types.has("form.question_answered")) return RADAR_PROFILE_FORM_COMPLETION.incomplete
  return RADAR_PROFILE_FORM_COMPLETION.startedWithoutAnswers
}

export function buildRadarProfileFormItems(input: {
  events: RadarProfileFormEventMarker[]
  forms: RadarProfileFormCatalogItem[]
}): RadarProfileFormItem[] {
  type Group = {
    formId: string
    eventTypes: Set<string>
    questionIds: Set<string>
    firstInteractionAt: Date
    lastInteractionAt: Date
  }

  const groups = new Map<string, Group>()
  for (const event of input.events) {
    const formId = formIdFromRadarEventMetadata(event.metadata)
    if (!formId) continue
    const existing = groups.get(formId)
    if (existing) {
      existing.eventTypes.add(event.eventType)
      const questionId = questionIdFromRadarEventMetadata(event.metadata)
      if (questionId) existing.questionIds.add(questionId)
      if (event.occurredAt < existing.firstInteractionAt) {
        existing.firstInteractionAt = event.occurredAt
      }
      if (event.occurredAt > existing.lastInteractionAt) {
        existing.lastInteractionAt = event.occurredAt
      }
      continue
    }

    const questionIds = new Set<string>()
    const questionId = questionIdFromRadarEventMetadata(event.metadata)
    if (questionId) questionIds.add(questionId)
    groups.set(formId, {
      formId,
      eventTypes: new Set([event.eventType]),
      questionIds,
      firstInteractionAt: event.occurredAt,
      lastInteractionAt: event.occurredAt,
    })
  }

  const formsById = new Map(input.forms.map((form) => [form.id, form]))
  const items = [...groups.values()].map((group) => {
    const form = formsById.get(group.formId)
    return {
      formId: group.formId,
      publicId: form?.publicId ?? null,
      name: form?.name ?? "Formulário",
      completionStatus: resolveRadarProfileFormCompletion(group.eventTypes),
      firstInteractionAt: group.firstInteractionAt.toISOString(),
      lastInteractionAt: group.lastInteractionAt.toISOString(),
      answeredQuestionCount: group.questionIds.size,
    } satisfies RadarProfileFormItem
  })

  items.sort((left, right) => right.lastInteractionAt.localeCompare(left.lastInteractionAt))
  return items
}

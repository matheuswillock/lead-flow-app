import type {
  PublicFormApprovalStatus,
  PublicFormMappingTarget,
  PublicFormQuestionType,
  PublicFormRuleAction,
  PublicFormRuleOperator,
  PublicFormStatus,
} from "@prisma/client"

export const PUBLIC_FORM_THANK_YOU_TARGET = "__thank_you__" as const

export type PublicFormScorePolarity = "positive" | "negative"

export type PublicFormSuccessActionType = "link" | "whatsapp" | "close"

export type PublicFormSuccessAction = {
  id: string
  label: string
  type: PublicFormSuccessActionType
  url?: string | null
  whatsappPhone?: string | null
  whatsappMessage?: string | null
}

export type PublicFormThankYouPageKind = "standard" | "simulation"

export type PublicFormThankYouPage = {
  id: string
  name: string
  title: string
  description?: string | null
  actions: PublicFormSuccessAction[]
  kind?: PublicFormThankYouPageKind
  isDefault?: boolean
}

export type PublicFormThemeColors = {
  backgroundColor: string
  textColor: string
  lineColor: string
  accentColor: string
  buttonTextColor: string
  inputBackgroundColor: string
}

export type PublicFormOptionInput = {
  id?: string
  label: string
  value: string
  score: number
  scorePolarity: PublicFormScorePolarity
}

export type PublicFormCoverHighlight = { id: string; value: string; label: string }

export type PublicFormQuestionInput = {
  id?: string
  type: PublicFormQuestionType
  title: string
  description?: string | null
  placeholder?: string | null
  required: boolean
  scoreWeight: number
  config?: Record<string, unknown>
  mappingTarget?: PublicFormMappingTarget | null
  mappingKey?: string | null
  options: PublicFormOptionInput[]
}

export type PublicFormRuleInput = {
  id?: string
  sourceQuestionId: string
  /** Question UUID or `PUBLIC_FORM_THANK_YOU_TARGET`. */
  targetQuestionId: string
  /** Thank-you page when target is thank-you; null/undefined uses default page. */
  targetThankYouPageId?: string | null
  operator: PublicFormRuleOperator
  comparisonValue?: unknown
  action: PublicFormRuleAction
  elseAction?: PublicFormRuleAction
}

export type PublicFormScoreBandInput = {
  id?: string
  label: string
  summary?: string | null
  minScore: number
  maxScore: number
}

export type PublicFormDraftInput = {
  name: string
  description?: string | null
  assignedSdrId?: string | null
  eligibleCloserIds: string[]
  coverTitle?: string | null
  coverDescription?: string | null
  coverBadge?: string | null
  coverHighlights?: PublicFormCoverHighlight[]
  ctaLabel: string
  successTitle: string
  successDescription?: string | null
  successActions: PublicFormSuccessAction[]
  thankYouPages: PublicFormThankYouPage[]
  defaultThankYouPageId: string
  useDefaultTheme: boolean
  backgroundColor?: string | null
  textColor?: string | null
  lineColor?: string | null
  accentColor?: string | null
  buttonTextColor?: string | null
  inputBackgroundColor?: string | null
  schedulingEnabled: boolean
  meetingDurationMinutes: number
  schedulingMessage?: string | null
  formKind?: "standard" | "health_plan_simulator"
  /**
   * SPEC 40 E4/DA4. Opt-out de captação: publica sem pergunta de contato
   * mapeada e suprime as métricas de lead do formulário. Não é "desligar
   * validação" — é declarar que este form é pesquisa, não aquisição.
   */
  leadCaptureDisabled?: boolean
  questions: PublicFormQuestionInput[]
  rules: PublicFormRuleInput[]
  scoreBands: PublicFormScoreBandInput[]
}

export type PublicFormSnapshot = Omit<PublicFormDraftInput, "questions"> & {
  formId: string
  publicId: string
  version: number
  publishedAt: string
  theme: PublicFormThemeColors
  eligibleClosers?: Array<{ id: string; name: string }>
  questions: Array<Omit<PublicFormQuestionInput, "id"> & { id: string; position: number }>
}

export type PublicFormListFilters = {
  search?: string
  status?: PublicFormStatus | PublicFormStatus[]
  approvalStatus?: PublicFormApprovalStatus | PublicFormApprovalStatus[]
  assignedSdrId?: string
  updatedFrom?: Date
  updatedTo?: Date
  page: number
  pageSize: number
}

export type PublicFormAnswerInput = { questionId: string; value: unknown }

export type PublicFormCompletionStatus = "initial" | "partial" | "complete"

/**
 * Taxonomia de eventos do contrato v1.
 *
 * `PUBLIC_FORM_CLIENT_EVENT_TYPES` é o que o navegador pode enviar por
 * `/events`. Os demais são derivados no servidor: `question_answered` nasce do
 * `/progress`, os de CRM nascem do gate, e `form_abandoned`/`form_resumed`
 * nascem do cron de jornada. Aceitar qualquer um deles vindo do cliente
 * permitiria forjar jornada e identidade.
 */
export const PUBLIC_FORM_CLIENT_EVENT_TYPES = [
  "form_viewed",
  "form_started",
  "question_viewed",
  "question_skipped",
  "question_focused",
  "page_viewed",
  "page_advanced",
  "page_returned",
  "form_submit_attempted",
  "form_validation_failed",
  "form_exit_intent",
  "form_completed",
] as const

export const PUBLIC_FORM_SERVER_ONLY_EVENT_TYPES = [
  "question_answered",
  "lead_created",
  "lead_attached",
  /**
   * SPEC 40 E2/DA2. Server-only por construção: quem decide o descarte é o
   * gate, e aceitar isto do navegador deixaria forjar o contrário de uma
   * conversão. `form_submit_failed` (valor de enum já provisionado na mesma
   * migration) fica de fora até a SPEC 41 definir quem emite.
   */
  "lead_discarded",
  "meeting_scheduled",
  "form_abandoned",
  "form_resumed",
] as const

export type PublicFormClientEventType = (typeof PUBLIC_FORM_CLIENT_EVENT_TYPES)[number]
export type PublicFormServerOnlyEventType = (typeof PUBLIC_FORM_SERVER_ONLY_EVENT_TYPES)[number]
export type PublicFormEventType = PublicFormClientEventType | PublicFormServerOnlyEventType

/** Eventos que movem a jornada; os demais não alteram a projeção da sessão. */
export const PUBLIC_FORM_JOURNEY_EVENT_TYPES = [
  "form_viewed",
  "form_started",
  "question_viewed",
  "question_skipped",
  "question_focused",
  "question_answered",
  "page_viewed",
  "page_advanced",
  "page_returned",
  "form_submit_attempted",
  "form_validation_failed",
  "form_exit_intent",
  "form_completed",
] as const

export type PublicFormProgressInput = {
  visitorSessionId: string
  answers: PublicFormAnswerInput[]
  origin?: Record<string, unknown>
  lastQuestionId?: string
  schemaVersion?: 1
  eventId?: string
  occurredAt?: string
  trigger?: "blur" | "change" | "page_flush" | "submit_reconciliation"
}

export type PublicFormSubmissionInput = {
  requestKey: string
  answers: PublicFormAnswerInput[]
  origin: Record<string, unknown>
  schemaVersion?: 1
  eventId?: string
  occurredAt?: string
  scheduling?: { startsAt: string }
  thankYouPageId?: string
  visitorSessionId?: string
}

export type PublicFormMetricEventInput = {
  visitorSessionId: string
  schemaVersion?: 1
  eventId?: string
  occurredAt?: string
  eventType: PublicFormEventType
  questionId?: string
  eventKey: string
  origin?: Record<string, unknown>
  /**
   * `mappingKey` da pergunta (D2 / gate A+C). Campo dedicado fora de `origin`.
   * O POST público NÃO aceita este campo no Zod — o worker preenche a partir
   * do snapshot. `answerValue` pode vir do cliente (o que foi digitado);
   * `answerMappingKey` forjado é ignorado.
   */
  answerMappingKey?: string | null
  answerValue?: unknown
  /** Jornada: página corrente. Nunca carrega valores de resposta. */
  pageId?: string | null
  pageIndex?: number | null
  /** `form_validation_failed`: apenas IDs e códigos, nunca o valor inválido. */
  validationCodes?: { questionId: string; code: string }[]
  /**
   * POST `/events` do renderer não cria CRM. Progress encaminha identidade
   * com `true` para o Radar reavaliar A+C a partir das respostas da sessão.
   */
  createCrmLead?: boolean
}

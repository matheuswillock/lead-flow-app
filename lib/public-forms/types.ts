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

export type PublicFormMetricEventInput = {
  visitorSessionId: string
  eventType:
    | "form_viewed"
    | "form_started"
    | "question_viewed"
    | "question_answered"
    | "question_skipped"
    | "form_completed"
  questionId?: string
  eventKey: string
  origin?: Record<string, unknown>
}

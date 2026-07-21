import type {
  PublicFormApprovalStatus,
  PublicFormMappingTarget,
  PublicFormQuestionType,
  PublicFormRuleAction,
  PublicFormRuleOperator,
  PublicFormStatus,
} from "@prisma/client"
export type PublicFormOptionInput = { id?: string; label: string; value: string; score: number }
export type PublicFormQuestionInput = {
  id?: string
  type: PublicFormQuestionType
  title: string
  description?: string | null
  placeholder?: string | null
  required: boolean
  config?: Record<string, unknown>
  mappingTarget?: PublicFormMappingTarget | null
  mappingKey?: string | null
  options: PublicFormOptionInput[]
}
export type PublicFormRuleInput = {
  id?: string
  sourceQuestionId: string
  targetQuestionId: string
  operator: PublicFormRuleOperator
  comparisonValue?: unknown
  action: PublicFormRuleAction
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
  ctaLabel: string
  successTitle: string
  successDescription?: string | null
  useDefaultTheme: boolean
  backgroundColor?: string | null
  textColor?: string | null
  lineColor?: string | null
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
  theme: { backgroundColor: string; textColor: string; lineColor: string }
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

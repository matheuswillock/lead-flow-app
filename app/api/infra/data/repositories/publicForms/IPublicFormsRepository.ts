import type {
  Lead,
  Prisma,
  PublicForm,
  PublicFormApprovalStatus,
  PublicFormMetricType,
  PublicFormPublication,
  PublicFormSettings,
  PublicFormStatus,
  PublicFormSubmission,
  UserRole,
} from "@prisma/client"
import type { PublicFormDraftInput, PublicFormListFilters } from "@/lib/public-forms/types"

export const publicFormDetailSelect = {
  id: true,
  teamId: true,
  publicId: true,
  name: true,
  description: true,
  status: true,
  approvalStatus: true,
  assignedSdrId: true,
  coverTitle: true,
  coverDescription: true,
  ctaLabel: true,
  successTitle: true,
  successDescription: true,
  useDefaultTheme: true,
  backgroundColor: true,
  textColor: true,
  lineColor: true,
  schedulingEnabled: true,
  meetingDurationMinutes: true,
  schedulingMessage: true,
  reviewComment: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedSdr: { select: { id: true, fullName: true, email: true } },
  eligibleClosers: {
    select: {
      profileId: true,
      profile: { select: { id: true, fullName: true, email: true } },
    },
  },
  questions: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      placeholder: true,
      required: true,
      config: true,
      mappingTarget: true,
      mappingKey: true,
      options: {
        orderBy: { position: "asc" as const },
        select: { id: true, label: true, value: true, score: true },
      },
    },
  },
  rules: {
    select: {
      id: true,
      sourceQuestionId: true,
      targetQuestionId: true,
      operator: true,
      comparisonValue: true,
      action: true,
    },
  },
  scoreBands: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      label: true,
      summary: true,
      minScore: true,
      maxScore: true,
    },
  },
  publications: {
    orderBy: { version: "desc" as const },
    take: 20,
    select: { id: true, version: true, publishedAt: true, endedAt: true },
  },
  _count: { select: { submissions: true } },
} satisfies Prisma.PublicFormSelect

export type PublicFormDetailRecord = Prisma.PublicFormGetPayload<{
  select: typeof publicFormDetailSelect
}>

export type PublicFormListItemRecord = Prisma.PublicFormGetPayload<{
  select: {
    id: true
    name: true
    publicId: true
    status: true
    approvalStatus: true
    assignedSdrId: true
    updatedAt: true
    assignedSdr: { select: { id: true; fullName: true } }
    _count: { select: { submissions: true } }
    publications: { select: { id: true; version: true } }
  }
}>

export type PublicFormPublishedOption = Pick<PublicForm, "id" | "name" | "publicId" | "status">

export type PublicFormPublishedSnapshot = {
  publicationId: string
  version: number
  snapshot: Prisma.JsonValue
}

export type PublicFormSubmissionContext = {
  id: string
  teamId: string
  assignedSdrId: string | null
  assignedSdr: { email: string | null } | null
  team: { master: { id: string; supabaseId: string | null } }
}

export type PublicFormCompleteSubmissionInput = {
  submissionId: string
  leadId: string
  answers: Array<{
    questionId: string
    value: Prisma.InputJsonValue
    questionSnapshot: Prisma.InputJsonValue
  }>
  activityBody: string
  activityPayload: Prisma.InputJsonValue
  metricEvents: Array<{
    formId: string
    publicationId: string
    visitorSessionId: string
    eventType: PublicFormMetricType
    eventKey: string
    origin: Prisma.InputJsonValue
  }>
}

export interface IPublicFormsRepository {
  listPublishedOptions(teamId: string): Promise<PublicFormPublishedOption[]>
  list(
    teamId: string,
    filters: PublicFormListFilters,
  ): Promise<{
    items: PublicFormListItemRecord[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
  findDetailByTeamAndId(teamId: string, id: string): Promise<PublicFormDetailRecord | null>
  findIdByTeamAndId(teamId: string, id: string): Promise<{ id: string } | null>
  findTeamMembersForAssignees(
    teamId: string,
    profileIds: string[],
  ): Promise<Array<{ profileId: string; functions: import("@prisma/client").UserFunction[] }>>
  createWithDraft(
    teamId: string,
    createdById: string,
    input: PublicFormDraftInput,
  ): Promise<PublicFormDetailRecord>
  updateWithDraft(id: string, input: PublicFormDraftInput): Promise<PublicFormDetailRecord>
  transition(
    id: string,
    input: {
      status?: PublicFormStatus
      approvalStatus?: PublicFormApprovalStatus
      reviewedById?: string
      reviewComment?: string | null
    },
  ): Promise<PublicForm>
  publish(
    formId: string,
    publishedById: string,
    version: number,
    snapshot: Prisma.InputJsonValue,
  ): Promise<PublicFormPublication>
  getSettings(teamId: string): Promise<PublicFormSettings>
  updateSettings(
    teamId: string,
    input: {
      approvalRequired: boolean
      approverRoles: UserRole[]
      defaultBackgroundColor: string
      defaultTextColor: string
      defaultLineColor: string
    },
  ): Promise<PublicFormSettings>
  findPublishedByPublicId(publicId: string): Promise<PublicFormPublishedSnapshot | null>
  findAvailabilityTeamContext(formId: string): Promise<{
    teamId: string
    team: { master: { timezone: string | null } }
  } | null>
  upsertMetricEvent(input: {
    formId: string
    publicationId: string
    questionId?: string | null
    visitorSessionId: string
    eventType: PublicFormMetricType
    eventKey: string
    origin: Prisma.InputJsonValue
  }): Promise<void>
  findAnalyticsPublications(
    teamId: string,
    id: string,
  ): Promise<Array<{
    id: string
    version: number
    publishedAt: Date
    endedAt: Date | null
    snapshot: Prisma.JsonValue
  }> | null>
  groupMetricEvents(
    formId: string,
    where: Prisma.PublicFormMetricEventWhereInput,
  ): Promise<
    Array<{
      eventType: PublicFormMetricType
      publicationId: string
      questionId: string | null
      _count: { _all: number }
    }>
  >
  listFormViewOrigins(
    where: Prisma.PublicFormMetricEventWhereInput,
  ): Promise<Array<{ origin: Prisma.JsonValue | null; visitorSessionId: string }>>
  listLeadSubmissions(teamId: string, leadId: string): Promise<unknown[]>
  findSubmissionByRequestKey(requestKey: string): Promise<PublicFormSubmission | null>
  createSubmission(data: {
    formId: string
    publicationId: string
    requestKey: string
    score: number
    scoreBandLabel?: string | null
    origin: Prisma.InputJsonValue
  }): Promise<PublicFormSubmission>
  findFormSubmissionContext(formId: string): Promise<PublicFormSubmissionContext>
  findLeadCandidates(
    teamId: string,
    email: string,
    phone: string,
    normalizedPhone: string,
  ): Promise<Lead[]>
  updateLead(leadId: string, data: Prisma.LeadUncheckedUpdateInput): Promise<Lead>
  findCustomFieldDefinitionId(teamId: string, key: string): Promise<string | null>
  upsertLeadCustomFieldValue(
    leadId: string,
    definitionId: string,
    value: Prisma.InputJsonValue,
  ): Promise<void>
  completeSubmission(input: PublicFormCompleteSubmissionInput): Promise<void>
  markSubmissionFailed(submissionId: string, errorMessage: string): Promise<void>
}

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
  managedByBackofficeUserId: true,
  coverTitle: true,
  coverDescription: true,
  coverBadge: true,
  coverHighlights: true,
  ctaLabel: true,
  successTitle: true,
  successDescription: true,
  successActions: true,
  thankYouPages: true,
  defaultThankYouPageId: true,
  useDefaultTheme: true,
  backgroundColor: true,
  textColor: true,
  lineColor: true,
  accentColor: true,
  buttonTextColor: true,
  inputBackgroundColor: true,
  schedulingEnabled: true,
  meetingDurationMinutes: true,
  schedulingMessage: true,
  formKind: true,
  emailCampaignTrackingEnabled: true,
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
      scoreWeight: true,
      config: true,
      mappingTarget: true,
      mappingKey: true,
      options: {
        orderBy: { position: "asc" as const },
        select: { id: true, label: true, value: true, score: true, scorePolarity: true },
      },
    },
  },
  rules: {
    select: {
      id: true,
      sourceQuestionId: true,
      targetQuestionId: true,
      targetThankYouPageId: true,
      operator: true,
      comparisonValue: true,
      action: true,
      elseAction: true,
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
    managedByBackofficeUserId: true
    emailCampaignTrackingEnabled: true
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
  name: string
  publicId: string
  teamId: string
  assignedSdrId: string | null
  emailCampaignTrackingEnabled: boolean
  assignedSdr: { email: string | null } | null
  team: { master: { id: string; supabaseId: string | null; timezone: string | null } }
}

export type PublicFormCompleteSubmissionInput = {
  submissionId: string
  leadId?: string | null
  processingAlerts?: string | null
  answers: Array<{
    questionId: string
    value: Prisma.InputJsonValue
    questionSnapshot: Prisma.InputJsonValue
  }>
  activityBody?: string
  activityPayload?: Prisma.InputJsonValue
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
      defaultAccentColor: string
      defaultButtonTextColor: string
      defaultInputBackgroundColor: string
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
  countDistinctSessionsByEventType(
    formId: string,
    where: Prisma.PublicFormMetricEventWhereInput,
  ): Promise<Record<string, number>>
  countDistinctCompletedLeads(
    formId: string,
    options?: { publicationId?: string; from?: Date; to?: Date },
  ): Promise<number>
  listFormViewOrigins(
    where: Prisma.PublicFormMetricEventWhereInput,
  ): Promise<Array<{ origin: Prisma.JsonValue | null; visitorSessionId: string }>>
  listFormConversionTotals(
    teamId: string,
    options?: { from?: Date; to?: Date },
  ): Promise<Array<{ formId: string; name: string; viewed: number; completed: number }>>
  listLeadSubmissions(teamId: string, leadId: string): Promise<unknown[]>
  copyLeadSubmissionsOnTeamTransfer(params: {
    leadId: string
    sourceTeamId: string
    targetTeamId: string
  }): Promise<{ copied: number; skipped: number }>
  findSubmissionByRequestKey(requestKey: string): Promise<PublicFormSubmission | null>
  findCompletedSubmissionBySession(
    publicationId: string,
    visitorSessionId: string,
  ): Promise<PublicFormSubmission | null>
  findProgressSubmission(
    publicationId: string,
    visitorSessionId: string,
  ): Promise<PublicFormSubmission | null>
  createSubmission(data: {
    formId: string
    publicationId: string
    requestKey: string
    visitorSessionId?: string | null
    score?: number
    scoreBandLabel?: string | null
    origin: Prisma.InputJsonValue
    completionStatus?: import("@prisma/client").PublicFormCompletionStatus
  }): Promise<PublicFormSubmission>
  upsertProgressSubmission(data: {
    formId: string
    publicationId: string
    visitorSessionId: string
    requestKey: string
    origin: Prisma.InputJsonValue
    completionStatus: import("@prisma/client").PublicFormCompletionStatus
    leadId?: string | null
    answers: Array<{
      questionId: string
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    }>
  }): Promise<PublicFormSubmission>
  findFormSubmissionContext(formId: string): Promise<PublicFormSubmissionContext>
  findCloserGoogleConnection(closerId: string): Promise<{
    googleConnection: {
      accessToken: string | null
      refreshToken: string | null
      tokenExpiresAt: Date | null
      revokedAt: Date | null
    } | null
  } | null>
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
  finalizeProgressSubmission(
    submissionId: string,
    data: {
      requestKey: string
      score: number
      scoreBandLabel?: string | null
      origin: Prisma.InputJsonValue
      visitorSessionId?: string | null
    },
  ): Promise<{ id: string }>
  completeSubmission(input: PublicFormCompleteSubmissionInput): Promise<void>
  persistSubmissionAnswers(
    submissionId: string,
    answers: Array<{
      questionId: string
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    }>,
  ): Promise<void>
  markSubmissionFailed(submissionId: string, errorMessage: string): Promise<void>
  /**
   * Claim atômico para retry de background: só falhas ou `processing` stale.
   * Retorna true se este caller ficou com o claim.
   */
  claimSubmissionForRetry(
    submissionId: string,
    publicationId: string,
    staleBefore: Date,
  ): Promise<boolean>
  findCampaignContactListIds(teamId: string, campaignId: string): Promise<string[]>
  findEmailContactCustomFields(
    email: string,
    listIds: string[],
  ): Promise<Prisma.JsonValue | null>
  findRadarPhoneByEmail(teamId: string, normalizedEmail: string): Promise<string | null>
  findLeadActivityByEmailLogAttribution(input: {
    leadId: string
    body: string
    emailLogId: string
  }): Promise<{ id: string } | null>
  createLeadActivityNote(input: {
    leadId: string
    body: string
    payload: Prisma.InputJsonValue
  }): Promise<void>
  findCompletedSubmissionsWithAnswersByLeadId(input: {
    teamId: string
    leadId: string
    take?: number
  }): Promise<
    Array<{
      id: string
      formId: string
      score: number
      scoreBandLabel: string | null
      submittedAt: Date | null
      createdAt: Date
      form: { name: string }
      answers: Array<{ value: Prisma.JsonValue; questionSnapshot: Prisma.JsonValue }>
    }>
  >
  listTemplatesForTeam(teamId: string): Promise<PublicFormTemplateListItem[]>
  findTemplateForTeam(
    teamId: string,
    slug: string,
  ): Promise<PublicFormTemplateDetailRecord | null>
}

export type PublicFormTemplateListItem = {
  id: string
  slug: string
  name: string
  description: string | null
  formKind: string
  sortOrder: number
}

export type PublicFormTemplateDetailRecord = PublicFormTemplateListItem & {
  draft: Prisma.JsonValue
}

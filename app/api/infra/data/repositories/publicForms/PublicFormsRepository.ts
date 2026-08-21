import { ActivityType, Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import type { PublicFormDraftInput, PublicFormListFilters } from "@/lib/public-forms/types"
import { isThankYouRuleTarget, normalizeThankYouPages } from "@/lib/public-forms/thank-you-pages"
import { inverseRuleAction } from "@/lib/public-forms/engine"
import {
  buildLeadTransferCopyOrigin,
  buildLeadTransferCopyRequestKey,
  resolveLeadTransferCopySourceSubmissionId,
  shouldSkipLeadTransferCopyForRootInTarget,
  SYSTEM_LEAD_TRANSFER_FORM_DESCRIPTION,
  SYSTEM_LEAD_TRANSFER_FORM_KIND,
  SYSTEM_LEAD_TRANSFER_FORM_NAME,
  mergeLeadTransferListSubmissions,
} from "@/lib/public-forms/lead-transfer-submission-copy"
import {
  isStaleQuestionIdForeignKey,
  questionIdFromSnapshot,
  resolveStoredSubmissionAnswerQuestionId,
  snapshotContainsAllQuestions,
  snapshotContainsQuestion,
} from "@/lib/public-forms/publication-snapshot"
import {
  type IPublicFormsRepository,
  type PublicFormCompleteSubmissionInput,
  type PublicFormDetailRecord,
  type PublicFormListItemRecord,
  type PublicFormPublishedOption,
  type PublicFormPublishedSnapshot,
  type PublicFormSubmissionContext,
  type PublicFormTemplateDetailRecord,
  type PublicFormTemplateListItem,
  publicFormDetailSelect,
} from "./IPublicFormsRepository"

function toPublishedSnapshot(publication: {
  id: string
  version: number
  snapshot: Prisma.JsonValue
}): PublicFormPublishedSnapshot {
  return {
    publicationId: publication.id,
    version: publication.version,
    snapshot: publication.snapshot,
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isPrismaUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function isBlankProgressAnswerValue(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

const PERSIST_ANSWER_FK_SAVEPOINT = "persist_answer_fk"
const PERSIST_ANSWER_WITHOUT_FK_SAVEPOINT = "persist_answer_without_fk"
/** Tombstone range above the live reorder band (100_000+) so unique(formId, position) stays free. */
export const SOFT_DELETED_QUESTION_POSITION_BASE = 1_000_000

type ProgressSubmissionWrite = {
  visitorSessionId: string
  completionStatus: import("@prisma/client").PublicFormCompletionStatus
  leadId?: string | null
  origin: Prisma.InputJsonValue
  answers: Array<{
    questionId: string
    value: Prisma.InputJsonValue
    questionSnapshot: Prisma.InputJsonValue
  }>
}

const leadSubmissionSelect = {
  id: true,
  formId: true,
  publicationId: true,
  leadId: true,
  requestKey: true,
  status: true,
  completionStatus: true,
  visitorSessionId: true,
  score: true,
  scoreBandLabel: true,
  origin: true,
  errorMessage: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  form: { select: { id: true, name: true } },
  publication: { select: { version: true } },
  answers: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      questionId: true,
      value: true,
      questionSnapshot: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PublicFormSubmissionSelect

export function nextSoftDeletedQuestionPosition(maxExistingDeletedPosition: number | null): number {
  return Math.max(
    SOFT_DELETED_QUESTION_POSITION_BASE,
    (maxExistingDeletedPosition ?? SOFT_DELETED_QUESTION_POSITION_BASE - 1) + 1,
  )
}

async function softDeleteQuestionsMissingFromDraft(
  tx: Prisma.TransactionClient,
  formId: string,
  incomingQuestionIds: string[],
) {
  const removed = await tx.publicFormQuestion.findMany({
    where: {
      formId,
      deletedAt: null,
      ...(incomingQuestionIds.length > 0 ? { id: { notIn: incomingQuestionIds } } : {}),
    },
    select: { id: true },
    orderBy: { position: "asc" },
  })
  if (removed.length === 0) return

  const maxTombstone = await tx.publicFormQuestion.aggregate({
    where: { formId, deletedAt: { not: null } },
    _max: { position: true },
  })
  const startPosition = nextSoftDeletedQuestionPosition(maxTombstone._max.position)
  const deletedAt = new Date()
  for (const [index, question] of removed.entries()) {
    await tx.publicFormQuestion.update({
      where: { id: question.id },
      data: {
        deletedAt,
        position: startPosition + index,
      },
    })
  }
}

async function replaceDraftRelations(
  tx: Prisma.TransactionClient,
  formId: string,
  input: PublicFormDraftInput,
) {
  // Rules must drop first so question upserts/deletes are not blocked by FKs.
  await tx.publicFormRule.deleteMany({ where: { formId } })
  await tx.publicFormScoreBand.deleteMany({ where: { formId } })
  await tx.publicFormEligibleCloser.deleteMany({ where: { formId } })

  const incomingQuestionIds = input.questions
    .map((question) => question.id)
    .filter((id): id is string => Boolean(id))
  await softDeleteQuestionsMissingFromDraft(tx, formId, incomingQuestionIds)

  // Avoid unique(formId, position) collisions while reordering existing live rows.
  const existingQuestions = await tx.publicFormQuestion.findMany({
    where: { formId, deletedAt: null },
    select: { id: true },
    orderBy: { position: "asc" },
  })
  for (const [index, question] of existingQuestions.entries()) {
    await tx.publicFormQuestion.update({
      where: { id: question.id },
      data: { position: 100_000 + index },
    })
  }

  if (input.eligibleCloserIds.length > 0) {
    await tx.publicFormEligibleCloser.createMany({
      data: input.eligibleCloserIds.map((profileId) => ({ formId, profileId })),
    })
  }

  for (const [position, question] of input.questions.entries()) {
    const questionId = question.id ?? randomUUID()
    await tx.publicFormOption.deleteMany({ where: { questionId } })
    await tx.publicFormQuestion.upsert({
      where: { id: questionId },
      create: {
        id: questionId,
        formId,
        type: question.type,
        title: question.title,
        description: question.description,
        placeholder: question.placeholder,
        required: question.required,
        scoreWeight: question.scoreWeight ?? 0,
        position,
        deletedAt: null,
        config: json(question.config ?? {}),
        mappingTarget: question.mappingTarget,
        mappingKey: question.mappingKey,
      },
      update: {
        formId,
        type: question.type,
        title: question.title,
        description: question.description,
        placeholder: question.placeholder,
        required: question.required,
        scoreWeight: question.scoreWeight ?? 0,
        position,
        deletedAt: null,
        config: json(question.config ?? {}),
        mappingTarget: question.mappingTarget,
        mappingKey: question.mappingKey,
      },
    })
    if (question.options.length > 0) {
      await tx.publicFormOption.createMany({
        data: question.options.map((option, optionPosition) => ({
          id: option.id ?? randomUUID(),
          questionId,
          label: option.label,
          value: option.value,
          score: option.score,
          scorePolarity: option.scorePolarity ?? "positive",
          position: optionPosition,
        })),
      })
    }
  }

  if (input.rules.length > 0) {
    await tx.publicFormRule.createMany({
      data: input.rules.map((rule) => ({
        id: rule.id,
        formId,
        sourceQuestionId: rule.sourceQuestionId,
        targetQuestionId:
          isThankYouRuleTarget(rule.targetQuestionId) ? null : rule.targetQuestionId,
        targetThankYouPageId: isThankYouRuleTarget(rule.targetQuestionId)
          ? rule.targetThankYouPageId ?? null
          : null,
        operator: rule.operator,
        comparisonValue:
          rule.comparisonValue === undefined ? Prisma.JsonNull : json(rule.comparisonValue),
        action: rule.action,
        elseAction: rule.elseAction ?? inverseRuleAction(rule.action),
      })),
    })
  }

  if (input.scoreBands.length > 0) {
    await tx.publicFormScoreBand.createMany({
      data: input.scoreBands.map((band, position) => ({
        id: band.id,
        formId,
        label: band.label,
        summary: band.summary,
        minScore: band.minScore,
        maxScore: band.maxScore,
        position,
      })),
    })
  }
}

export class PublicFormsRepository implements IPublicFormsRepository {
  listPublishedOptions(teamId: string): Promise<PublicFormPublishedOption[]> {
    return prisma.publicForm.findMany({
      where: {
        teamId,
        status: "published",
        publications: { some: { endedAt: null } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, publicId: true, status: true },
    })
  }

  async list(teamId: string, filters: PublicFormListFilters) {
    const where: Prisma.PublicFormWhereInput = {
      teamId,
      formKind: { not: SYSTEM_LEAD_TRANSFER_FORM_KIND },
      ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
      ...(filters.status
        ? { status: Array.isArray(filters.status) ? { in: filters.status } : filters.status }
        : {}),
      ...(filters.approvalStatus
        ? {
            approvalStatus: Array.isArray(filters.approvalStatus)
              ? { in: filters.approvalStatus }
              : filters.approvalStatus,
          }
        : {}),
      ...(filters.assignedSdrId ? { assignedSdrId: filters.assignedSdrId } : {}),
      ...(filters.updatedFrom || filters.updatedTo
        ? { updatedAt: { gte: filters.updatedFrom, lte: filters.updatedTo } }
        : {}),
    }
    const [items, total] = await prisma.$transaction([
      prisma.publicForm.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: {
          id: true,
          name: true,
          publicId: true,
          status: true,
          approvalStatus: true,
          assignedSdrId: true,
          managedByBackofficeUserId: true,
          emailCampaignTrackingEnabled: true,
          updatedAt: true,
          assignedSdr: { select: { id: true, fullName: true } },
          _count: { select: { submissions: true } },
          publications: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true, version: true },
          },
        },
      }),
      prisma.publicForm.count({ where }),
    ])
    return {
      items: items as PublicFormListItemRecord[],
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    }
  }

  findDetailByTeamAndId(teamId: string, id: string): Promise<PublicFormDetailRecord | null> {
    return prisma.publicForm.findFirst({
      where: { id, teamId },
      select: publicFormDetailSelect,
    })
  }

  findIdByTeamAndId(teamId: string, id: string): Promise<{ id: string } | null> {
    return prisma.publicForm.findFirst({ where: { id, teamId }, select: { id: true } })
  }

  findTeamMembersForAssignees(teamId: string, profileIds: string[]) {
    return prisma.teamMember.findMany({
      where: { teamId, profileId: { in: profileIds } },
      select: { profileId: true, functions: true },
    })
  }

  async createWithDraft(
    teamId: string,
    createdById: string,
    input: PublicFormDraftInput,
  ): Promise<PublicFormDetailRecord> {
    const draft = normalizeThankYouPages(input)
    return prisma.$transaction(async (tx) => {
      const form = await tx.publicForm.create({
        data: {
          teamId,
          createdById,
          name: draft.name,
          description: draft.description,
          assignedSdrId: draft.assignedSdrId,
          coverTitle: draft.coverTitle,
          coverDescription: draft.coverDescription,
          coverBadge: draft.coverBadge,
          coverHighlights: json(draft.coverHighlights ?? []),
          ctaLabel: draft.ctaLabel,
          successTitle: draft.successTitle,
          successDescription: draft.successDescription,
          successActions: json(draft.successActions ?? []),
          thankYouPages: json(draft.thankYouPages),
          defaultThankYouPageId: draft.defaultThankYouPageId,
          useDefaultTheme: draft.useDefaultTheme,
          backgroundColor: draft.backgroundColor,
          textColor: draft.textColor,
          lineColor: draft.lineColor,
          accentColor: draft.accentColor,
          buttonTextColor: draft.buttonTextColor,
          inputBackgroundColor: draft.inputBackgroundColor,
          schedulingEnabled: draft.schedulingEnabled,
          meetingDurationMinutes: draft.meetingDurationMinutes,
          schedulingMessage: draft.schedulingMessage,
          formKind: draft.formKind ?? "standard",
        },
      })
      await replaceDraftRelations(tx, form.id, draft)
      return tx.publicForm.findUniqueOrThrow({
        where: { id: form.id },
        select: publicFormDetailSelect,
      })
    })
  }

  async updateWithDraft(id: string, input: PublicFormDraftInput): Promise<PublicFormDetailRecord> {
    const draft = normalizeThankYouPages(input)
    return prisma.$transaction(async (tx) => {
      await tx.publicForm.update({
        where: { id },
        data: {
          name: draft.name,
          description: draft.description,
          assignedSdrId: draft.assignedSdrId,
          coverTitle: draft.coverTitle,
          coverDescription: draft.coverDescription,
          coverBadge: draft.coverBadge,
          coverHighlights: json(draft.coverHighlights ?? []),
          ctaLabel: draft.ctaLabel,
          successTitle: draft.successTitle,
          successDescription: draft.successDescription,
          successActions: json(draft.successActions ?? []),
          thankYouPages: json(draft.thankYouPages),
          defaultThankYouPageId: draft.defaultThankYouPageId,
          useDefaultTheme: draft.useDefaultTheme,
          backgroundColor: draft.backgroundColor,
          textColor: draft.textColor,
          lineColor: draft.lineColor,
          accentColor: draft.accentColor,
          buttonTextColor: draft.buttonTextColor,
          inputBackgroundColor: draft.inputBackgroundColor,
          schedulingEnabled: draft.schedulingEnabled,
          meetingDurationMinutes: draft.meetingDurationMinutes,
          schedulingMessage: draft.schedulingMessage,
          formKind: draft.formKind ?? "standard",
          approvalStatus: "draft",
          reviewedById: null,
          reviewedAt: null,
          reviewComment: null,
        },
      })
      await replaceDraftRelations(tx, id, draft)
      return tx.publicForm.findUniqueOrThrow({
        where: { id },
        select: publicFormDetailSelect,
      })
    })
  }

  async transition(
    id: string,
    input: {
      status?: import("@prisma/client").PublicFormStatus
      approvalStatus?: import("@prisma/client").PublicFormApprovalStatus
      reviewedById?: string
      reviewComment?: string | null
    },
  ) {
    return prisma.$transaction(async (tx) => {
      if (input.status === "archived") {
        await tx.publicFormPublication.updateMany({
          where: { formId: id, endedAt: null },
          data: { endedAt: new Date() },
        })
      }
      return tx.publicForm.update({
        where: { id },
        data: { ...input, reviewedAt: input.reviewedById ? new Date() : undefined },
      })
    })
  }

  async publish(
    formId: string,
    publishedById: string,
    version: number,
    snapshot: Prisma.InputJsonValue,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.publicFormPublication.updateMany({
        where: { formId, endedAt: null },
        data: { endedAt: new Date() },
      })
      const publication = await tx.publicFormPublication.create({
        data: { formId, publishedById, version, snapshot },
      })
      await tx.publicForm.update({
        where: { id: formId },
        data: {
          status: "published",
          approvalStatus: "approved",
          reviewedById: publishedById,
          reviewedAt: new Date(),
          reviewComment: null,
        },
      })
      return publication
    })
  }

  getSettings(teamId: string) {
    return prisma.publicFormSettings.upsert({
      where: { teamId },
      create: { teamId },
      update: {},
    })
  }

  updateSettings(
    teamId: string,
    input: {
      approvalRequired: boolean
      approverRoles: import("@prisma/client").UserRole[]
      defaultBackgroundColor: string
      defaultTextColor: string
      defaultLineColor: string
      defaultAccentColor: string
      defaultButtonTextColor: string
      defaultInputBackgroundColor: string
    },
  ) {
    return prisma.publicFormSettings.upsert({
      where: { teamId },
      create: { teamId, ...input },
      update: input,
    })
  }

  async findTeamIdByPublicId(publicId: string): Promise<string | null> {
    const row = await prisma.publicForm.findUnique({
      where: { publicId },
      select: { teamId: true },
    })
    return row?.teamId ?? null
  }

  async findPublishedByPublicId(publicId: string): Promise<PublicFormPublishedSnapshot | null> {
    const form = await prisma.publicForm.findUnique({
      where: { publicId },
      select: {
        status: true,
        publications: {
          where: { endedAt: null },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true, snapshot: true },
        },
      },
    })
    if (!form || form.status !== "published" || !form.publications[0]) return null
    return toPublishedSnapshot(form.publications[0])
  }

  async findPublicationById(id: string): Promise<PublicFormPublishedSnapshot | null> {
    const publication = await prisma.publicFormPublication.findUnique({
      where: { id },
      select: { id: true, version: true, snapshot: true },
    })
    return publication ? toPublishedSnapshot(publication) : null
  }

  private listFormPublications(formId: string) {
    return prisma.publicFormPublication.findMany({
      where: { formId },
      orderBy: { version: "desc" },
      select: { id: true, version: true, snapshot: true },
    })
  }

  async findPublicationContainingQuestion(
    formId: string,
    questionId: string,
  ): Promise<PublicFormPublishedSnapshot | null> {
    const publications = await this.listFormPublications(formId)
    const match = publications.find((publication) =>
      snapshotContainsQuestion(publication.snapshot, questionId),
    )
    return match ? toPublishedSnapshot(match) : null
  }

  async findPublicationContainingQuestions(
    formId: string,
    questionIds: string[],
  ): Promise<PublicFormPublishedSnapshot | null> {
    const uniqueIds = [...new Set(questionIds.filter(Boolean))]
    const publications = await this.listFormPublications(formId)
    const match = publications.find((publication) =>
      snapshotContainsAllQuestions(publication.snapshot, uniqueIds),
    )
    return match ? toPublishedSnapshot(match) : null
  }

  findLatestSessionSubmissionOnForm(formId: string, visitorSessionId: string) {
    return prisma.publicFormSubmission.findFirst({
      where: { formId, visitorSessionId },
      orderBy: { updatedAt: "desc" },
    })
  }

  async attachLeadIdToSessionSubmission(
    formId: string,
    visitorSessionId: string,
    leadId: string,
  ) {
    const session = await this.findLatestSessionSubmissionOnForm(formId, visitorSessionId)
    if (!session) return null
    if (session.leadId) return session
    return prisma.publicFormSubmission.update({
      where: { id: session.id },
      data: {
        leadId,
        ...(session.completionStatus === "complete" ? {} : { completionStatus: "partial" }),
      },
    })
  }

  findAvailabilityTeamContext(formId: string) {
    return prisma.publicForm.findUnique({
      where: { id: formId },
      select: {
        teamId: true,
        name: true,
        publicId: true,
        emailCampaignTrackingEnabled: true,
        team: { select: { master: { select: { timezone: true } } } },
      },
    })
  }

  async questionExists(id: string): Promise<boolean> {
    const found = await prisma.publicFormQuestion.findUnique({
      where: { id },
      select: { id: true },
    })
    return found !== null
  }

  async upsertMetricEvent(input: {
    formId: string
    publicationId: string
    questionId?: string | null
    questionSnapshot?: Prisma.InputJsonValue | null
    visitorSessionId: string
    eventType: import("@prisma/client").PublicFormMetricType
    eventKey: string
    eventId?: string | null
    schemaVersion?: number | null
    occurredAt?: Date | null
    origin: Prisma.InputJsonValue
  }) {
    const create = (questionId: string | null | undefined) => ({
      formId: input.formId,
      publicationId: input.publicationId,
      questionId,
      questionSnapshot: input.questionSnapshot ?? Prisma.JsonNull,
      visitorSessionId: input.visitorSessionId,
      eventType: input.eventType,
      eventKey: input.eventKey,
      eventId: input.eventId,
      schemaVersion: input.schemaVersion,
      occurredAt: input.occurredAt,
      origin: input.origin,
    })

    try {
      await prisma.publicFormMetricEvent.upsert({
        where: { eventKey: input.eventKey },
        create: create(input.questionId),
        update: {},
      })
    } catch (error) {
      // A pergunta viva (`PublicFormQuestion`) pode ser editada/removida
      // entre o disparo do evento (no navegador, usando a publicação
      // congelada que ele carregou) e o consumo da fila — o `questionId`
      // vira uma FK obsoleta. Isso é permanente (não transiente): sem esse
      // fallback, a fila reentrega para sempre (visto em produção com
      // deliveryCount >100) sem nunca conseguir persistir. `questionSnapshot`
      // já carrega a cópia congelada da pergunta (resolvida a partir do
      // `snapshot` da publicação, mesmo padrão de `PublicFormAnswer`), então
      // soltar o FK aqui não perde rastreabilidade — só a conveniência de
      // join "ao vivo".
      if (!isStaleQuestionIdForeignKey(error, input.questionId)) throw error

      console.info("[PublicFormsRepository][upsertMetricEvent] questionId obsoleto, gravando sem o FK (questionSnapshot preserva os dados)", {
        eventKey: input.eventKey,
        questionId: input.questionId,
      })
      await prisma.publicFormMetricEvent.upsert({
        where: { eventKey: input.eventKey },
        create: create(null),
        update: {},
      })
    }
  }

  async findAnalyticsPublications(teamId: string, id: string) {
    const form = await prisma.publicForm.findFirst({
      where: { id, teamId },
      select: {
        publications: {
          orderBy: { version: "desc" },
          select: { id: true, version: true, publishedAt: true, endedAt: true, snapshot: true },
        },
      },
    })
    return form?.publications ?? null
  }

  async groupMetricEvents(formId: string, where: Prisma.PublicFormMetricEventWhereInput) {
    const rows = await prisma.publicFormMetricEvent.findMany({
      where: { formId, ...where },
      select: {
        eventType: true,
        publicationId: true,
        questionId: true,
        visitorSessionId: true,
      },
    })

    const buckets = new Map<
      string,
      {
        eventType: (typeof rows)[number]["eventType"]
        publicationId: string
        questionId: string | null
        sessions: Set<string>
      }
    >()

    for (const row of rows) {
      const key = `${row.eventType}\0${row.publicationId}\0${row.questionId ?? ""}`
      const bucket = buckets.get(key) ?? {
        eventType: row.eventType,
        publicationId: row.publicationId,
        questionId: row.questionId,
        sessions: new Set<string>(),
      }
      bucket.sessions.add(row.visitorSessionId)
      buckets.set(key, bucket)
    }

    return Array.from(buckets.values()).map((bucket) => ({
      eventType: bucket.eventType,
      publicationId: bucket.publicationId,
      questionId: bucket.questionId,
      _count: { _all: bucket.sessions.size },
    }))
  }

  async countDistinctSessionsByEventType(
    formId: string,
    where: Prisma.PublicFormMetricEventWhereInput,
  ) {
    const rows = await prisma.publicFormMetricEvent.findMany({
      where: { formId, ...where },
      select: { eventType: true, visitorSessionId: true },
    })
    const byType = new Map<string, Set<string>>()
    for (const row of rows) {
      const sessions = byType.get(row.eventType) ?? new Set<string>()
      sessions.add(row.visitorSessionId)
      byType.set(row.eventType, sessions)
    }
    return Object.fromEntries(
      Array.from(byType, ([eventType, sessions]) => [eventType, sessions.size]),
    ) as Record<string, number>
  }

  listFormViewOrigins(where: Prisma.PublicFormMetricEventWhereInput) {
    return prisma.publicFormMetricEvent.findMany({
      where: { ...where, eventType: "form_viewed" },
      select: { origin: true, visitorSessionId: true },
    })
  }

  async countDistinctCompletedLeads(
    formId: string,
    options?: { publicationId?: string; from?: Date; to?: Date },
  ) {
    const rows = await prisma.publicFormSubmission.findMany({
      where: {
        formId,
        status: "completed",
        leadId: { not: null },
        ...(options?.publicationId ? { publicationId: options.publicationId } : {}),
        ...(options?.from || options?.to
          ? {
              submittedAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      select: { leadId: true },
      distinct: ["leadId"],
    })
    return rows.length
  }

  async listFormConversionTotals(teamId: string, options?: { from?: Date; to?: Date }) {
    const forms = await prisma.publicForm.findMany({
      where: { teamId },
      select: { id: true, name: true },
    })
    if (forms.length === 0) return []

    const formIds = forms.map((form) => form.id)
    const dateFilter =
      options?.from || options?.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}

    const rows = await prisma.publicFormMetricEvent.findMany({
      where: {
        formId: { in: formIds },
        eventType: { in: ["form_viewed", "form_completed"] },
        ...dateFilter,
      },
      select: {
        formId: true,
        eventType: true,
        visitorSessionId: true,
      },
    })

    const byForm = new Map(
      forms.map((form) => [
        form.id,
        {
          formId: form.id,
          name: form.name,
          viewedSessions: new Set<string>(),
          completedSessions: new Set<string>(),
        },
      ]),
    )

    for (const row of rows) {
      const entry = byForm.get(row.formId)
      if (!entry) continue
      if (row.eventType === "form_viewed") entry.viewedSessions.add(row.visitorSessionId)
      if (row.eventType === "form_completed") entry.completedSessions.add(row.visitorSessionId)
    }

    return Array.from(byForm.values()).map((entry) => ({
      formId: entry.formId,
      name: entry.name,
      viewed: entry.viewedSessions.size,
      completed: entry.completedSessions.size,
    }))
  }

  async listLeadSubmissions(teamId: string, leadId: string) {
    const scoped = await prisma.publicFormSubmission.findMany({
      where: { leadId, form: { teamId } },
      orderBy: { createdAt: "desc" },
      select: leadSubmissionSelect,
    })

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { teamId: true },
    })
    if (!lead) {
      return scoped
    }

    const inboundTransfers = await prisma.leadTransfer.findMany({
      where: { leadId, toTeamId: teamId },
      select: { fromTeamId: true },
      distinct: ["fromTeamId"],
    })

    const authorized = lead.teamId === teamId || inboundTransfers.length > 0
    if (!authorized || inboundTransfers.length === 0) {
      return scoped
    }

    // Merge submissions do time atual com histórico legado dos times de origem
    // (leads transferidos antes da cópia automática, ou origem ainda só no time A).
    const sourceTeamIds = inboundTransfers.map((transfer) => transfer.fromTeamId)
    const legacy = await prisma.publicFormSubmission.findMany({
      where: { leadId, form: { teamId: { in: sourceTeamIds } } },
      orderBy: { createdAt: "desc" },
      select: leadSubmissionSelect,
    })

    // Deduplica por submission raiz: cópia no time destino (scoped) prevalece sobre a origem.
    return mergeLeadTransferListSubmissions(scoped, legacy)
  }

  async copyLeadSubmissionsOnTeamTransfer(params: {
    leadId: string
    sourceTeamId: string
    targetTeamId: string
  }): Promise<{ copied: number; skipped: number }> {
    const { leadId, sourceTeamId, targetTeamId } = params

    const sourceSubmissions = await prisma.publicFormSubmission.findMany({
      where: { leadId, form: { teamId: sourceTeamId } },
      select: {
        id: true,
        origin: true,
        completionStatus: true,
        status: true,
        score: true,
        scoreBandLabel: true,
        submittedAt: true,
        form: { select: { id: true, name: true } },
        answers: { select: { value: true, questionSnapshot: true } },
      },
    })

    if (sourceSubmissions.length === 0) {
      return { copied: 0, skipped: 0 }
    }

    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      select: { masterId: true },
    })
    if (!targetTeam) {
      return { copied: 0, skipped: sourceSubmissions.length }
    }

    return prisma.$transaction(async (tx) => {
      const carrier = await this.ensureLeadTransferCarrierForm(
        targetTeamId,
        targetTeam.masterId,
        tx,
      )

      let copied = 0
      let skipped = 0

      for (const submission of sourceSubmissions) {
        const sourceSubmissionId = resolveLeadTransferCopySourceSubmissionId(
          submission.origin,
          submission.id,
        )
        const requestKey = buildLeadTransferCopyRequestKey(sourceSubmissionId, targetTeamId)
        const existing = await tx.publicFormSubmission.findUnique({
          where: { requestKey },
          select: { id: true },
        })
        if (existing) {
          skipped += 1
          continue
        }

        const rootSubmission = await tx.publicFormSubmission.findUnique({
          where: { id: sourceSubmissionId },
          select: { form: { select: { teamId: true } } },
        })
        if (
          shouldSkipLeadTransferCopyForRootInTarget({
            rootSubmissionTeamId: rootSubmission?.form.teamId,
            targetTeamId,
          })
        ) {
          skipped += 1
          continue
        }

        await tx.publicFormSubmission.create({
          data: {
            formId: carrier.formId,
            publicationId: carrier.publicationId,
            leadId,
            requestKey,
            completionStatus: submission.completionStatus,
            status: submission.status,
            score: submission.score,
            scoreBandLabel: submission.scoreBandLabel,
            submittedAt: submission.submittedAt,
            origin: json(
              buildLeadTransferCopyOrigin({
                sourceOrigin: submission.origin,
                sourceSubmissionId,
                sourceFormId: submission.form.id,
                sourceFormName: submission.form.name,
                sourceTeamId,
                targetTeamId,
                copiedAt: new Date(),
              }),
            ),
            answers: {
              create: submission.answers.map((answer) => ({
                questionId: null,
                value: json(answer.value),
                questionSnapshot: json(answer.questionSnapshot),
              })),
            },
          },
        })
        copied += 1
      }

      return { copied, skipped }
    })
  }

  /**
   * Formulário "carregador" por time, usado só para hospedar cópias de submissions de
   * leads transferidos de outro time. Nunca é publicado/preenchido pelo público e é
   * filtrado da listagem normal de formulários (ver `list()`, filtro por formKind).
   *
   * Race condition aceita: duas transferências concorrentes para o MESMO time, sendo a
   * primeira vez que esse time recebe uma cópia, podem criar 2 formulários carregadores
   * em paralelo (find-then-create sem lock/unique constraint dedicado). Consequência é
   * benigna — dados corretos, só duas linhas de "formulário sistema" em vez de uma — e
   * evitar isso exigiria uma migration nova, fora de escopo deste fix.
   */
  private async ensureLeadTransferCarrierForm(
    teamId: string,
    masterProfileId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const existing = await db.publicForm.findFirst({
      where: { teamId, formKind: SYSTEM_LEAD_TRANSFER_FORM_KIND },
      select: {
        id: true,
        publications: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    })
    if (existing?.publications[0]) {
      return { formId: existing.id, publicationId: existing.publications[0].id }
    }
    if (existing) {
      const publication = await db.publicFormPublication.create({
        data: {
          formId: existing.id,
          publishedById: masterProfileId,
          version: 1,
          snapshot: { systemCarrier: true },
        },
        select: { id: true },
      })
      return { formId: existing.id, publicationId: publication.id }
    }

    const form = await db.publicForm.create({
      data: {
        teamId,
        createdById: masterProfileId,
        name: SYSTEM_LEAD_TRANSFER_FORM_NAME,
        description: SYSTEM_LEAD_TRANSFER_FORM_DESCRIPTION,
        status: "archived",
        approvalStatus: "approved",
        formKind: SYSTEM_LEAD_TRANSFER_FORM_KIND,
      },
      select: { id: true },
    })
    const publication = await db.publicFormPublication.create({
      data: {
        formId: form.id,
        publishedById: masterProfileId,
        version: 1,
        snapshot: { systemCarrier: true },
      },
      select: { id: true },
    })
    return { formId: form.id, publicationId: publication.id }
  }

  findSubmissionByRequestKey(requestKey: string) {
    return prisma.publicFormSubmission.findUnique({ where: { requestKey } })
  }

  async findLeadForSubmission(submissionId: string) {
    const submission = await prisma.publicFormSubmission.findUnique({
      where: { id: submissionId },
      select: { lead: true },
    })
    return submission?.lead ?? null
  }

  findCompletedSubmissionBySession(publicationId: string, visitorSessionId: string) {
    return prisma.publicFormSubmission.findFirst({
      where: {
        publicationId,
        visitorSessionId,
        status: "completed",
      },
      orderBy: { submittedAt: "desc" },
    })
  }

  findProgressSubmission(publicationId: string, visitorSessionId: string) {
    return prisma.publicFormSubmission.findFirst({
      where: {
        publicationId,
        visitorSessionId,
        completionStatus: { in: ["initial", "partial"] },
      },
      orderBy: { updatedAt: "desc" },
    })
  }

  async listSubmissionAnswers(submissionId: string) {
    const rows = await prisma.publicFormAnswer.findMany({
      where: { submissionId },
      select: { questionId: true, value: true, questionSnapshot: true },
    })
    return rows.flatMap((row) => {
      const questionId = resolveStoredSubmissionAnswerQuestionId(
        row.questionId,
        row.questionSnapshot,
      )
      return questionId ? [{ questionId, value: row.value as unknown }] : []
    })
  }

  findFormsByIdsForTeam(
    teamId: string,
    formIds: string[],
  ): Promise<Array<{ id: string; name: string; publicId: string }>> {
    if (formIds.length === 0) return Promise.resolve([])
    return prisma.publicForm.findMany({
      where: { teamId, id: { in: formIds } },
      select: { id: true, name: true, publicId: true },
    })
  }

  createSubmission(data: {
    formId: string
    publicationId: string
    requestKey: string
    eventId?: string | null
    visitorSessionId?: string | null
    score?: number
    scoreBandLabel?: string | null
    origin: Prisma.InputJsonValue
    completionStatus?: import("@prisma/client").PublicFormCompletionStatus
  }) {
    return prisma.publicFormSubmission.create({
      data: {
        ...data,
        score: data.score ?? 0,
      },
    })
  }

  async upsertProgressSubmission(data: {
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
  }) {
    const existing = await this.findProgressSubmission(data.publicationId, data.visitorSessionId)
    if (existing) {
      return this.updateProgressSubmissionWithAnswers(existing.id, data, existing.leadId)
    }

    try {
      const submission = await prisma.publicFormSubmission.create({
        data: {
          formId: data.formId,
          publicationId: data.publicationId,
          requestKey: data.requestKey,
          visitorSessionId: data.visitorSessionId,
          completionStatus: data.completionStatus,
          leadId: data.leadId ?? null,
          origin: data.origin,
          score: 0,
        },
      })
      await this.withVisitorProgressLock(data.visitorSessionId, async (tx) => {
        await this.mergeSubmissionAnswers(tx, submission.id, data.answers)
      })
      return submission
    } catch (error) {
      if (!isPrismaUniqueConstraint(error)) throw error
      const winner = await this.findSubmissionByRequestKey(data.requestKey)
      if (!winner) throw error
      console.info(
        "[PublicFormsRepository][upsertProgressSubmission] requestKey em disputa, reusando o vencedor",
        { requestKey: data.requestKey, submissionId: winner.id },
      )
      return this.updateProgressSubmissionWithAnswers(winner.id, data, winner.leadId)
    }
  }

  private async updateProgressSubmissionWithAnswers(
    submissionId: string,
    data: ProgressSubmissionWrite,
    previousLeadId: string | null,
  ) {
    await this.withVisitorProgressLock(data.visitorSessionId, async (tx) => {
      await tx.publicFormSubmission.update({
        where: { id: submissionId },
        data: {
          completionStatus: data.completionStatus,
          leadId: data.leadId ?? previousLeadId,
          origin: data.origin,
        },
      })
      await this.mergeSubmissionAnswers(tx, submissionId, data.answers)
    })
    return prisma.publicFormSubmission.findUniqueOrThrow({ where: { id: submissionId } })
  }

  private async withVisitorProgressLock(
    visitorSessionId: string,
    work: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`public-form-progress:${visitorSessionId}`}))`
      await work(tx)
    })
  }

  findFormSubmissionContext(formId: string): Promise<PublicFormSubmissionContext> {
    return prisma.publicForm.findUniqueOrThrow({
      where: { id: formId },
      select: {
        id: true,
        name: true,
        publicId: true,
        teamId: true,
        assignedSdrId: true,
        emailCampaignTrackingEnabled: true,
        assignedSdr: { select: { email: true } },
        team: { select: { master: { select: { id: true, supabaseId: true, timezone: true } } } },
      },
    })
  }

  findCloserGoogleConnection(closerId: string) {
    return prisma.profile.findUnique({
      where: { id: closerId },
      select: {
        googleConnection: {
          select: {
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
            revokedAt: true,
          },
        },
      },
    })
  }

  findLeadCandidates(teamId: string, email: string, phone: string, normalizedPhone: string) {
    return prisma.lead.findMany({
      where: {
        teamId,
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }, { phone: normalizedPhone }] : []),
        ],
      },
      take: 20,
    })
  }

  updateLead(leadId: string, data: Prisma.LeadUncheckedUpdateInput) {
    return prisma.lead.update({ where: { id: leadId }, data })
  }

  async findCustomFieldDefinitionId(teamId: string, key: string) {
    const definition = await prisma.leadCustomFieldDefinition.findUnique({
      where: { teamId_key: { teamId, key } },
      select: { id: true },
    })
    return definition?.id ?? null
  }

  async upsertLeadCustomFieldValue(
    leadId: string,
    definitionId: string,
    value: Prisma.InputJsonValue,
  ) {
    await prisma.leadCustomFieldValue.upsert({
      where: { leadId_definitionId: { leadId, definitionId } },
      create: { leadId, definitionId, value },
      update: { value },
    })
  }

  private async syncSubmissionAnswers(
    tx: Prisma.TransactionClient,
    submissionId: string,
    answers: Array<{
      questionId: string
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    }>,
  ) {
    const questionIds = answers.map((answer) => answer.questionId).filter(Boolean)
    await tx.publicFormAnswer.deleteMany({
      where: {
        submissionId,
        ...(questionIds.length > 0
          ? {
              // `NULL NOT IN (...)` não casa no Postgres; sem este OR o fallback
              // P2003 (questionId null) acumula duplicatas a cada progress/retry.
              OR: [{ questionId: { notIn: questionIds } }, { questionId: null }],
            }
          : {}),
      },
    })
    for (const answer of answers) {
      await this.writeSubmissionAnswer(tx, submissionId, answer)
    }
  }

  private async mergeSubmissionAnswers(
    tx: Prisma.TransactionClient,
    submissionId: string,
    answers: Array<{
      questionId: string
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    }>,
  ) {
    // Blur payloads carry one answer; deleteMany would wipe a concurrent full-page save.
    // Queue retries can still deliver a stale empty blur after a filled save of the same question.
    for (const answer of answers) {
      if (await this.shouldSkipBlankProgressOverwrite(tx, submissionId, answer)) continue
      await this.writeSubmissionAnswer(tx, submissionId, answer)
    }
  }

  private async shouldSkipBlankProgressOverwrite(
    tx: Prisma.TransactionClient,
    submissionId: string,
    answer: {
      questionId: string
      value: Prisma.InputJsonValue
    },
  ): Promise<boolean> {
    if (!answer.questionId || !isBlankProgressAnswerValue(answer.value)) return false
    const existing = await tx.publicFormAnswer.findUnique({
      where: {
        submissionId_questionId: {
          submissionId,
          questionId: answer.questionId,
        },
      },
      select: { value: true },
    })
    return Boolean(existing && !isBlankProgressAnswerValue(existing.value))
  }

  private async withTransactionSavepoint<T>(
    tx: Prisma.TransactionClient,
    savepointName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    await tx.$executeRawUnsafe(`SAVEPOINT ${savepointName}`)
    try {
      const result = await operation()
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepointName}`)
      return result
    } catch (error) {
      try {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepointName}`)
      } catch (rollbackError) {
        console.error("[PublicFormsRepository][withTransactionSavepoint] rollback falhou", {
          savepointName,
          rollbackError,
        })
      }
      throw error
    }
  }

  private async writeSubmissionAnswer(
    tx: Prisma.TransactionClient,
    submissionId: string,
    answer: {
      questionId: string | null
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    },
  ) {
    if (!answer.questionId) {
      await this.persistAnswerWithoutQuestionFk(tx, submissionId, {
        value: answer.value,
        questionSnapshot: answer.questionSnapshot,
      })
      return
    }

    const questionId = answer.questionId
    const data = {
      submissionId,
      questionId,
      value: answer.value,
      questionSnapshot: answer.questionSnapshot,
    }

    try {
      await this.withTransactionSavepoint(tx, PERSIST_ANSWER_FK_SAVEPOINT, () =>
        tx.publicFormAnswer.upsert({
          where: {
            submissionId_questionId: {
              submissionId,
              questionId,
            },
          },
          create: data,
          update: {
            value: answer.value,
            questionSnapshot: answer.questionSnapshot,
          },
        }),
      )
    } catch (error) {
      if (!isStaleQuestionIdForeignKey(error, questionId)) throw error
      console.info("[PublicFormsRepository][writeSubmissionAnswer] questionId obsoleto, gravando sem o FK", {
        submissionId,
        questionId,
      })
      await this.persistAnswerWithoutQuestionFk(tx, submissionId, {
        value: data.value,
        questionSnapshot: data.questionSnapshot,
      })
    }
  }

  private async persistAnswerWithoutQuestionFk(
    tx: Prisma.TransactionClient,
    submissionId: string,
    data: {
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    },
  ) {
    const snapshotId = questionIdFromSnapshot(data.questionSnapshot)
    if (snapshotId) {
      const existing = await tx.publicFormAnswer.findMany({
        where: { submissionId, questionId: null },
        select: { id: true, questionSnapshot: true },
      })
      const match = existing.find((row) => questionIdFromSnapshot(row.questionSnapshot) === snapshotId)
      if (match) {
        await this.withTransactionSavepoint(tx, PERSIST_ANSWER_WITHOUT_FK_SAVEPOINT, () =>
          tx.publicFormAnswer.update({
            where: { id: match.id },
            data: {
              value: data.value,
              questionSnapshot: data.questionSnapshot,
            },
          }),
        )
        return
      }
    }
    await this.withTransactionSavepoint(tx, PERSIST_ANSWER_WITHOUT_FK_SAVEPOINT, () =>
      tx.publicFormAnswer.create({
        data: {
          submissionId,
          questionId: null,
          value: data.value,
          questionSnapshot: data.questionSnapshot,
        },
      }),
    )
  }

  finalizeProgressSubmission(
    submissionId: string,
    data: {
      requestKey: string
      eventId?: string | null
      score: number
      scoreBandLabel?: string | null
      origin: Prisma.InputJsonValue
      visitorSessionId?: string | null
    },
  ) {
    return prisma.publicFormSubmission.update({
      where: { id: submissionId },
      data: {
        requestKey: data.requestKey,
        eventId: data.eventId,
        score: data.score,
        scoreBandLabel: data.scoreBandLabel,
        origin: data.origin,
        visitorSessionId: data.visitorSessionId,
        completionStatus: "partial",
      },
      select: { id: true, eventId: true },
    })
  }

  async persistSubmissionAnswers(
    submissionId: string,
    answers: Array<{
      questionId: string
      value: Prisma.InputJsonValue
      questionSnapshot: Prisma.InputJsonValue
    }>,
  ) {
    await prisma.$transaction(async (tx) => {
      await this.syncSubmissionAnswers(tx, submissionId, answers)
    })
  }

  async completeSubmission(input: PublicFormCompleteSubmissionInput) {
    await prisma.$transaction(async (tx) => {
      await tx.publicFormSubmission.update({
        where: { id: input.submissionId },
        data: {
          leadId: input.leadId ?? undefined,
          status: "completed",
          completionStatus: "complete",
          submittedAt: new Date(),
          errorMessage: input.processingAlerts?.slice(0, 2000) ?? null,
        },
      })
      await this.syncSubmissionAnswers(tx, input.submissionId, input.answers)
      if (input.leadId && input.activityBody && input.activityPayload) {
        await tx.leadActivity.create({
          data: {
            leadId: input.leadId,
            type: ActivityType.note,
            body: input.activityBody,
            payload: input.activityPayload,
          },
        })
      }
      for (const event of input.metricEvents) {
        const create = (questionId: string | null | undefined) => ({
          formId: event.formId,
          publicationId: event.publicationId,
          questionId,
          questionSnapshot: event.questionSnapshot ?? Prisma.JsonNull,
          visitorSessionId: event.visitorSessionId,
          eventType: event.eventType,
          eventKey: event.eventKey,
          origin: event.origin,
        })
        try {
          await tx.publicFormMetricEvent.upsert({
            where: { eventKey: event.eventKey },
            create: create(event.questionId),
            update: {},
          })
        } catch (error) {
          if (!isStaleQuestionIdForeignKey(error, event.questionId)) throw error
          await tx.publicFormMetricEvent.upsert({
            where: { eventKey: event.eventKey },
            create: create(null),
            update: {},
          })
        }
      }
    })
  }

  async markSubmissionFailed(submissionId: string, errorMessage: string) {
    await prisma.publicFormSubmission.update({
      where: { id: submissionId },
      data: { status: "failed", errorMessage: errorMessage.slice(0, 2000) },
    })
  }

  async claimSubmissionForRetry(
    submissionId: string,
    publicationId: string,
    staleBefore: Date,
  ) {
    const result = await prisma.publicFormSubmission.updateMany({
      where: {
        id: submissionId,
        publicationId,
        OR: [
          { status: "failed" },
          { status: "processing", updatedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: "processing",
        errorMessage: null,
      },
    })
    return result.count === 1
  }

  async markSubmissionDispatchAccepted(submissionId: string): Promise<void> {
    await prisma.publicFormSubmission.update({
      where: { id: submissionId },
      data: {
        dispatchAcceptedAt: new Date(),
        dispatchAttemptCount: { increment: 1 },
        nextDispatchAt: null,
        lastDispatchError: null,
      },
    })
  }

  async markSubmissionDispatchDeferred(submissionId: string, errorMessage: string): Promise<void> {
    await prisma.publicFormSubmission.update({
      where: { id: submissionId },
      data: {
        dispatchAttemptCount: { increment: 1 },
        nextDispatchAt: new Date(Date.now() + 5 * 60_000),
        lastDispatchError: errorMessage.slice(0, 2_000),
      },
    })
  }

  async findCampaignContactListIds(teamId: string, campaignId: string) {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, teamId },
      select: { contactListId: true, sourceContactListIds: true },
    })
    if (!campaign) return []
    return [
      ...(campaign.contactListId ? [campaign.contactListId] : []),
      ...campaign.sourceContactListIds,
    ]
  }

  async findEmailContactCustomFields(email: string, listIds: string[]) {
    if (listIds.length === 0) return null
    const contact = await prisma.emailContact.findFirst({
      where: { email, listId: { in: listIds } },
      select: { customFields: true },
      orderBy: { updatedAt: "desc" },
    })
    return contact?.customFields ?? null
  }

  async findRadarPhoneByEmail(teamId: string, normalizedEmail: string) {
    const identity = await prisma.radarIdentity.findFirst({
      where: { teamId, type: "email", normalizedValue: normalizedEmail },
      select: { profileId: true },
    })
    if (!identity) return null
    const phoneIdentity = await prisma.radarIdentity.findFirst({
      where: { profileId: identity.profileId, type: "phone" },
      select: { value: true, normalizedValue: true },
    })
    return phoneIdentity?.value ?? phoneIdentity?.normalizedValue ?? null
  }

  async findLeadActivityByEmailLogAttribution(input: {
    leadId: string
    body: string
    emailLogId: string
  }) {
    return prisma.leadActivity.findFirst({
      where: {
        leadId: input.leadId,
        type: ActivityType.note,
        body: input.body,
        payload: {
          path: ["emailLogId"],
          equals: input.emailLogId,
        },
      },
      select: { id: true },
    })
  }

  async createLeadActivityNote(input: {
    leadId: string
    body: string
    payload: Prisma.InputJsonValue
  }) {
    await prisma.leadActivity.create({
      data: {
        leadId: input.leadId,
        type: ActivityType.note,
        body: input.body,
        payload: input.payload,
      },
    })
  }

  async findCompletedSubmissionsWithAnswersByLeadId(input: {
    teamId: string
    leadId: string
    take?: number
  }) {
    return prisma.publicFormSubmission.findMany({
      where: {
        leadId: input.leadId,
        form: { teamId: input.teamId },
        status: "completed",
      },
      select: {
        id: true,
        formId: true,
        score: true,
        scoreBandLabel: true,
        submittedAt: true,
        createdAt: true,
        form: { select: { name: true } },
        answers: {
          select: {
            value: true,
            questionSnapshot: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: input.take ?? 20,
    })
  }

  listTemplatesForTeam(_teamId: string): Promise<PublicFormTemplateListItem[]> {
    return prisma.publicFormTemplate.findMany({
      where: {
        isActive: true,
        teamId: null,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        formKind: true,
        sortOrder: true,
      },
    })
  }

  findTemplateForTeam(
    _teamId: string,
    slug: string,
  ): Promise<PublicFormTemplateDetailRecord | null> {
    return prisma.publicFormTemplate.findFirst({
      where: {
        slug,
        isActive: true,
        teamId: null,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        formKind: true,
        sortOrder: true,
        draft: true,
      },
    })
  }
}

export const publicFormsRepository = new PublicFormsRepository()

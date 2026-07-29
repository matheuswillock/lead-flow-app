import { ActivityType, Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import type { PublicFormDraftInput, PublicFormListFilters } from "@/lib/public-forms/types"
import { isThankYouRuleTarget, normalizeThankYouPages } from "@/lib/public-forms/thank-you-pages"
import {
  type IPublicFormsRepository,
  type PublicFormCompleteSubmissionInput,
  type PublicFormDetailRecord,
  type PublicFormListItemRecord,
  type PublicFormPublishedOption,
  type PublicFormPublishedSnapshot,
  type PublicFormSubmissionContext,
  publicFormDetailSelect,
} from "./IPublicFormsRepository"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
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
  await tx.publicFormQuestion.deleteMany({
    where: {
      formId,
      ...(incomingQuestionIds.length > 0 ? { id: { notIn: incomingQuestionIds } } : {}),
    },
  })

  // Avoid unique(formId, position) collisions while reordering existing rows.
  const existingQuestions = await tx.publicFormQuestion.findMany({
    where: { formId },
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
        elseAction: rule.elseAction ?? (rule.action === "show" ? "skip" : "show"),
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
    return {
      publicationId: form.publications[0].id,
      version: form.publications[0].version,
      snapshot: form.publications[0].snapshot,
    }
  }

  findAvailabilityTeamContext(formId: string) {
    return prisma.publicForm.findUnique({
      where: { id: formId },
      select: {
        teamId: true,
        team: { select: { master: { select: { timezone: true } } } },
      },
    })
  }

  async upsertMetricEvent(input: {
    formId: string
    publicationId: string
    questionId?: string | null
    visitorSessionId: string
    eventType: import("@prisma/client").PublicFormMetricType
    eventKey: string
    origin: Prisma.InputJsonValue
  }) {
    await prisma.publicFormMetricEvent.upsert({
      where: { eventKey: input.eventKey },
      create: {
        formId: input.formId,
        publicationId: input.publicationId,
        questionId: input.questionId,
        visitorSessionId: input.visitorSessionId,
        eventType: input.eventType,
        eventKey: input.eventKey,
        origin: input.origin,
      },
      update: {},
    })
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

  groupMetricEvents(formId: string, where: Prisma.PublicFormMetricEventWhereInput) {
    return prisma.publicFormMetricEvent.groupBy({
      by: ["eventType", "publicationId", "questionId"],
      where: { formId, ...where },
      _count: { _all: true },
    })
  }

  listFormViewOrigins(where: Prisma.PublicFormMetricEventWhereInput) {
    return prisma.publicFormMetricEvent.findMany({
      where: { ...where, eventType: "form_viewed" },
      select: { origin: true, visitorSessionId: true },
    })
  }

  listLeadSubmissions(teamId: string, leadId: string) {
    return prisma.publicFormSubmission.findMany({
      where: { leadId, form: { teamId } },
      orderBy: { createdAt: "desc" },
      select: {
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
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            questionId: true,
            value: true,
            questionSnapshot: true,
            createdAt: true,
          },
        },
      },
    })
  }

  findSubmissionByRequestKey(requestKey: string) {
    return prisma.publicFormSubmission.findUnique({ where: { requestKey } })
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

  createSubmission(data: {
    formId: string
    publicationId: string
    requestKey: string
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
      await prisma.$transaction(async (tx) => {
        await tx.publicFormSubmission.update({
          where: { id: existing.id },
          data: {
            completionStatus: data.completionStatus,
            leadId: data.leadId ?? existing.leadId,
            origin: data.origin,
          },
        })
        for (const answer of data.answers) {
          await tx.publicFormAnswer.upsert({
            where: {
              submissionId_questionId: {
                submissionId: existing.id,
                questionId: answer.questionId,
              },
            },
            create: {
              submissionId: existing.id,
              questionId: answer.questionId,
              value: answer.value,
              questionSnapshot: answer.questionSnapshot,
            },
            update: {
              value: answer.value,
              questionSnapshot: answer.questionSnapshot,
            },
          })
        }
      })
      return prisma.publicFormSubmission.findUniqueOrThrow({ where: { id: existing.id } })
    }

    return prisma.$transaction(async (tx) => {
      const submission = await tx.publicFormSubmission.create({
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
      for (const answer of data.answers) {
        await tx.publicFormAnswer.create({
          data: {
            submissionId: submission.id,
            questionId: answer.questionId,
            value: answer.value,
            questionSnapshot: answer.questionSnapshot,
          },
        })
      }
      return submission
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

  async completeSubmission(input: PublicFormCompleteSubmissionInput) {
    await prisma.$transaction(async (tx) => {
      await tx.publicFormSubmission.update({
        where: { id: input.submissionId },
        data: {
          leadId: input.leadId,
          status: "completed",
          completionStatus: "complete",
          submittedAt: new Date(),
        },
      })
      for (const answer of input.answers) {
        await tx.publicFormAnswer.upsert({
          where: {
            submissionId_questionId: {
              submissionId: input.submissionId,
              questionId: answer.questionId,
            },
          },
          create: {
            submissionId: input.submissionId,
            questionId: answer.questionId,
            value: answer.value,
            questionSnapshot: answer.questionSnapshot,
          },
          update: {
            value: answer.value,
            questionSnapshot: answer.questionSnapshot,
          },
        })
      }
      await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: ActivityType.note,
          body: input.activityBody,
          payload: input.activityPayload,
        },
      })
      for (const event of input.metricEvents) {
        await tx.publicFormMetricEvent.upsert({
          where: { eventKey: event.eventKey },
          create: {
            formId: event.formId,
            publicationId: event.publicationId,
            visitorSessionId: event.visitorSessionId,
            eventType: event.eventType,
            eventKey: event.eventKey,
            origin: event.origin,
          },
          update: {},
        })
      }
    })
  }

  async markSubmissionFailed(submissionId: string, errorMessage: string) {
    await prisma.publicFormSubmission.update({
      where: { id: submissionId },
      data: { status: "failed", errorMessage: errorMessage.slice(0, 2000) },
    })
  }
}

export const publicFormsRepository = new PublicFormsRepository()

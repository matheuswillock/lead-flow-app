import type {
  PublicFormApprovalStatus,
  PublicFormStatus,
  UserRole,
} from "@prisma/client"
import { Prisma } from "@prisma/client"
import type { PublicFormDetailRecord } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import type {
  PublicFormDraftInput,
  PublicFormListFilters,
  PublicFormMetricEventInput,
  PublicFormSnapshot,
} from "@/lib/public-forms/types"
import { sanitizePublicFormOrigin } from "@/lib/public-forms/origin"
import type { IPublicFormsService } from "./IPublicFormsService"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function mapPublicFormDraft(form: PublicFormDetailRecord): PublicFormDraftInput {
  return {
    name: form.name,
    description: form.description,
    assignedSdrId: form.assignedSdrId,
    eligibleCloserIds: form.eligibleClosers.map((item) => item.profileId),
    coverTitle: form.coverTitle,
    coverDescription: form.coverDescription,
    coverBadge: form.coverBadge,
    coverHighlights: Array.isArray(form.coverHighlights)
      ? (form.coverHighlights as Array<{ id: string; value: string; label: string }>)
      : [],
    ctaLabel: form.ctaLabel,
    successTitle: form.successTitle,
    successDescription: form.successDescription,
    useDefaultTheme: form.useDefaultTheme,
    backgroundColor: form.backgroundColor,
    textColor: form.textColor,
    lineColor: form.lineColor,
    schedulingEnabled: form.schedulingEnabled,
    meetingDurationMinutes: form.meetingDurationMinutes,
    schedulingMessage: form.schedulingMessage,
    formKind:
      form.formKind === "health_plan_simulator" ? "health_plan_simulator" : "standard",
    questions: form.questions.map((question) => ({
      id: question.id,
      type: question.type,
      title: question.title,
      description: question.description,
      placeholder: question.placeholder,
      required: question.required,
      config: question.config as Record<string, unknown>,
      mappingTarget: question.mappingTarget,
      mappingKey: question.mappingKey,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        value: option.value,
        score: option.score,
      })),
    })),
    rules: form.rules.map((rule) => ({
      id: rule.id,
      sourceQuestionId: rule.sourceQuestionId,
      targetQuestionId: rule.targetQuestionId,
      operator: rule.operator,
      comparisonValue: rule.comparisonValue,
      action: rule.action,
      elseAction: rule.elseAction ?? (rule.action === "show" ? "skip" : "show"),
    })),
    scoreBands: form.scoreBands.map((band) => ({
      id: band.id,
      label: band.label,
      summary: band.summary,
      minScore: band.minScore,
      maxScore: band.maxScore,
    })),
  }
}

export function buildPublicFormPreviewSnapshot(form: PublicFormDetailRecord): PublicFormSnapshot {
  const draft = mapPublicFormDraft(form)
  return {
    ...draft,
    formId: form.id,
    publicId: form.publicId,
    version: form.publications[0]?.version ?? 0,
    publishedAt: new Date().toISOString(),
    theme: {
      backgroundColor: draft.backgroundColor ?? "#FFFFFF",
      textColor: draft.textColor ?? "#18181B",
      lineColor: draft.lineColor ?? "#E4E4E7",
    },
    eligibleClosers: form.eligibleClosers.map((item) => ({
      id: item.profileId,
      name: item.profile.fullName || "Consultor",
    })),
    questions: draft.questions.map((question, position) => ({
      ...question,
      id: question.id ?? crypto.randomUUID(),
      position,
    })),
  }
}

async function validateTeamAssignees(teamId: string, input: PublicFormDraftInput) {
  const profileIds = Array.from(
    new Set([input.assignedSdrId, ...input.eligibleCloserIds].filter(Boolean) as string[]),
  )
  if (profileIds.length === 0) return
  const members = await publicFormsRepository.findTeamMembersForAssignees(teamId, profileIds)
  const byProfile = new Map(members.map((member) => [member.profileId, member.functions]))
  if (input.assignedSdrId && !byProfile.get(input.assignedSdrId)?.includes("SDR")) {
    throw new Error("Selecione um SDR que pertença ao time")
  }
  if (input.eligibleCloserIds.some((id) => !byProfile.get(id)?.includes("CLOSER"))) {
    throw new Error("Todos os closers selecionados devem pertencer ao time")
  }
}

export class PublicFormsService implements IPublicFormsService {
  listPublishedOptions(teamId: string) {
    return publicFormsRepository.listPublishedOptions(teamId)
  }

  list(teamId: string, filters: PublicFormListFilters) {
    return publicFormsRepository.list(teamId, filters)
  }

  get(teamId: string, id: string) {
    return publicFormsRepository.findDetailByTeamAndId(teamId, id)
  }

  async create(teamId: string, createdById: string, input: PublicFormDraftInput) {
    await validateTeamAssignees(teamId, input)
    return publicFormsRepository.createWithDraft(teamId, createdById, input)
  }

  async update(teamId: string, id: string, input: PublicFormDraftInput) {
    const found = await publicFormsRepository.findIdByTeamAndId(teamId, id)
    if (!found) return null
    await validateTeamAssignees(teamId, input)
    return publicFormsRepository.updateWithDraft(id, input)
  }

  async duplicate(teamId: string, id: string, profileId: string) {
    const form = await this.get(teamId, id)
    if (!form) return null
    const input = mapPublicFormDraft(form)
    const questionIdMap = new Map<string, string>()
    const questions = input.questions.map((question) => {
      const nextId = crypto.randomUUID()
      if (question.id) questionIdMap.set(question.id, nextId)
      return {
        ...question,
        id: nextId,
        options: question.options.map((option) => ({ ...option, id: crypto.randomUUID() })),
      }
    })
    return this.create(teamId, profileId, {
      ...input,
      name: `${form.name} (cópia)`,
      questions,
      rules: input.rules.map((rule) => ({
        ...rule,
        id: crypto.randomUUID(),
        sourceQuestionId: questionIdMap.get(rule.sourceQuestionId) ?? rule.sourceQuestionId,
        targetQuestionId: questionIdMap.get(rule.targetQuestionId) ?? rule.targetQuestionId,
      })),
      scoreBands: input.scoreBands.map((band) => ({ ...band, id: crypto.randomUUID() })),
    })
  }

  async transition(
    teamId: string,
    id: string,
    input: {
      status?: PublicFormStatus
      approvalStatus?: PublicFormApprovalStatus
      reviewedById?: string
      reviewComment?: string | null
    },
  ) {
    const found = await publicFormsRepository.findIdByTeamAndId(teamId, id)
    if (!found) return null
    return publicFormsRepository.transition(id, input)
  }

  async publish(teamId: string, id: string, profileId: string) {
    const form = await this.get(teamId, id)
    if (!form) return null
    const settings = await this.getSettings(teamId)
    const draft = mapPublicFormDraft(form)
    const version = (form.publications[0]?.version ?? 0) + 1
    const theme = draft.useDefaultTheme
      ? {
          backgroundColor: settings.defaultBackgroundColor,
          textColor: settings.defaultTextColor,
          lineColor: settings.defaultLineColor,
        }
      : {
          backgroundColor: draft.backgroundColor ?? "#FFFFFF",
          textColor: draft.textColor ?? "#18181B",
          lineColor: draft.lineColor ?? "#E4E4E7",
        }
    const snapshot: PublicFormSnapshot = {
      ...draft,
      formId: id,
      publicId: form.publicId,
      version,
      publishedAt: new Date().toISOString(),
      theme,
      eligibleClosers: form.eligibleClosers.map((closer) => ({
        id: closer.profileId,
        name: closer.profile.fullName || "Consultor",
      })),
      questions: draft.questions.map((question, position) => ({
        ...question,
        id: question.id ?? crypto.randomUUID(),
        position,
      })),
    }
    return publicFormsRepository.publish(id, profileId, version, json(snapshot))
  }

  getSettings(teamId: string) {
    return publicFormsRepository.getSettings(teamId)
  }

  updateSettings(
    teamId: string,
    input: {
      approvalRequired: boolean
      approverRoles: UserRole[]
      defaultBackgroundColor: string
      defaultTextColor: string
      defaultLineColor: string
    },
  ) {
    return publicFormsRepository.updateSettings(teamId, input)
  }

  getPublic(publicId: string) {
    return publicFormsRepository.findPublishedByPublicId(publicId)
  }

  async getAvailabilityContext(publicId: string) {
    const current = await this.getPublic(publicId)
    if (!current) return null
    const snapshot = current.snapshot as unknown as PublicFormSnapshot
    const form = await publicFormsRepository.findAvailabilityTeamContext(snapshot.formId)
    return form ? { ...current, snapshot, ...form } : null
  }

  async recordMetric(publicId: string, input: PublicFormMetricEventInput) {
    const current = (await this.getPublic(publicId)) as {
      publicationId: string
      snapshot: PublicFormSnapshot
    } | null
    if (!current) return false
    if (
      input.questionId &&
      !current.snapshot.questions.some((item) => item.id === input.questionId)
    ) {
      return false
    }
    await publicFormsRepository.upsertMetricEvent({
      formId: current.snapshot.formId,
      publicationId: current.publicationId,
      questionId: input.questionId,
      visitorSessionId: input.visitorSessionId,
      eventType: input.eventType,
      eventKey: input.eventKey,
      origin: json(sanitizePublicFormOrigin(input.origin ?? {})),
    })
    return true
  }

  async analytics(teamId: string, id: string, from?: Date, to?: Date, publicationId?: string) {
    const publications = await publicFormsRepository.findAnalyticsPublications(teamId, id)
    if (!publications) return null
    const where: Prisma.PublicFormMetricEventWhereInput = {
      ...(publicationId ? { publicationId } : {}),
      ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
    }
    const events = await publicFormsRepository.groupMetricEvents(id, where)
    const originEvents = await publicFormsRepository.listFormViewOrigins({ formId: id, ...where })
    const origins = new Map<string, Set<string>>()
    for (const event of originEvents) {
      const origin = event.origin as Record<string, unknown>
      const label = String(origin.utmSource || origin.source || "direct").slice(0, 160)
      const sessions = origins.get(label) ?? new Set<string>()
      sessions.add(event.visitorSessionId)
      origins.set(label, sessions)
    }
    return {
      publications: publications.map((publication) => {
        const snapshot = publication.snapshot as unknown as PublicFormSnapshot
        return {
          id: publication.id,
          version: publication.version,
          publishedAt: publication.publishedAt,
          endedAt: publication.endedAt,
          questions: snapshot.questions.map((question) => ({
            id: question.id,
            title: question.title,
            position: question.position,
          })),
        }
      }),
      events,
      origins: Array.from(origins, ([source, sessions]) => ({
        source,
        sessions: sessions.size,
      })).sort((a, b) => b.sessions - a.sessions),
    }
  }

  listLeadSubmissions(teamId: string, leadId: string) {
    return publicFormsRepository.listLeadSubmissions(teamId, leadId)
  }
}

export const publicFormsService = new PublicFormsService()

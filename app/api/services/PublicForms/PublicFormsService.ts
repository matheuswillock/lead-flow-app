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
  PublicFormScorePolarity,
  PublicFormSnapshot,
  PublicFormSuccessAction,
  PublicFormThemeColors,
} from "@/lib/public-forms/types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "@/lib/public-forms/types"
import { normalizeThankYouPages, parseThankYouPages } from "@/lib/public-forms/thank-you-pages"
import { redistributeQuestionScoresEvenly } from "@/lib/public-forms/scoring"
import { sanitizePublicFormOrigin } from "@/lib/public-forms/origin"
import type { IPublicFormsService } from "./IPublicFormsService"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function parseSuccessActions(value: unknown): PublicFormSuccessAction[] {
  if (!Array.isArray(value)) return []
  const actions: PublicFormSuccessAction[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const type = record.type
    if (type !== "link" && type !== "whatsapp" && type !== "close") continue
    if (typeof record.id !== "string" || typeof record.label !== "string") continue
    actions.push({
      id: record.id,
      label: record.label,
      type,
      url: typeof record.url === "string" ? record.url : null,
      whatsappPhone: typeof record.whatsappPhone === "string" ? record.whatsappPhone : null,
      whatsappMessage:
        typeof record.whatsappMessage === "string" ? record.whatsappMessage : null,
    })
  }
  return actions
}

function parseScorePolarity(value: unknown): PublicFormScorePolarity {
  return value === "negative" ? "negative" : "positive"
}

const DEFAULT_THEME: PublicFormThemeColors = {
  backgroundColor: "#FFFFFF",
  textColor: "#18181B",
  lineColor: "#E4E4E7",
  accentColor: "#FF6900",
  buttonTextColor: "#FFFFFF",
  inputBackgroundColor: "#FFFFFF",
}

export function mapPublicFormDraft(form: PublicFormDetailRecord): PublicFormDraftInput {
  const questions = form.questions.map((question) => ({
    id: question.id,
    type: question.type,
    title: question.title,
    description: question.description,
    placeholder: question.placeholder,
    required: question.required,
    scoreWeight: question.scoreWeight ?? 0,
    config: question.config as Record<string, unknown>,
    mappingTarget: question.mappingTarget,
    mappingKey: question.mappingKey,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      value: option.value,
      score: option.score,
      scorePolarity: parseScorePolarity(option.scorePolarity),
    })),
  }))

  const needsRebalance =
    questions.length > 0 &&
    questions.reduce((sum, question) => sum + question.scoreWeight, 0) !== 100

  return normalizeThankYouPages({
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
    successActions: parseSuccessActions(form.successActions),
    thankYouPages: parseThankYouPages(form.thankYouPages),
    defaultThankYouPageId: form.defaultThankYouPageId ?? "",
    useDefaultTheme: form.useDefaultTheme,
    backgroundColor: form.backgroundColor,
    textColor: form.textColor,
    lineColor: form.lineColor,
    accentColor: form.accentColor,
    buttonTextColor: form.buttonTextColor,
    inputBackgroundColor: form.inputBackgroundColor,
    schedulingEnabled: form.schedulingEnabled,
    meetingDurationMinutes: form.meetingDurationMinutes,
    schedulingMessage: form.schedulingMessage,
    formKind:
      form.formKind === "health_plan_simulator" ? "health_plan_simulator" : "standard",
    questions: needsRebalance ? redistributeQuestionScoresEvenly(questions) : questions,
    rules: form.rules.map((rule) => ({
      id: rule.id,
      sourceQuestionId: rule.sourceQuestionId,
      targetQuestionId: rule.targetQuestionId ?? PUBLIC_FORM_THANK_YOU_TARGET,
      targetThankYouPageId: rule.targetThankYouPageId,
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
  })
}

function resolveThemeFromDraft(
  draft: PublicFormDraftInput,
  settings?: {
    defaultBackgroundColor: string
    defaultTextColor: string
    defaultLineColor: string
    defaultAccentColor: string
    defaultButtonTextColor: string
    defaultInputBackgroundColor: string
  } | null,
): PublicFormThemeColors {
  if (draft.useDefaultTheme && settings) {
    return {
      backgroundColor: settings.defaultBackgroundColor,
      textColor: settings.defaultTextColor,
      lineColor: settings.defaultLineColor,
      accentColor: settings.defaultAccentColor,
      buttonTextColor: settings.defaultButtonTextColor,
      inputBackgroundColor: settings.defaultInputBackgroundColor,
    }
  }
  return {
    backgroundColor: draft.backgroundColor ?? DEFAULT_THEME.backgroundColor,
    textColor: draft.textColor ?? DEFAULT_THEME.textColor,
    lineColor: draft.lineColor ?? DEFAULT_THEME.lineColor,
    accentColor: draft.accentColor ?? DEFAULT_THEME.accentColor,
    buttonTextColor: draft.buttonTextColor ?? DEFAULT_THEME.buttonTextColor,
    inputBackgroundColor: draft.inputBackgroundColor ?? DEFAULT_THEME.inputBackgroundColor,
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
    theme: resolveThemeFromDraft(draft),
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
    const thankYouPageIdMap = new Map<string, string>()
    const thankYouPages = input.thankYouPages.map((page) => {
      const nextId = crypto.randomUUID()
      thankYouPageIdMap.set(page.id, nextId)
      return {
        ...page,
        id: nextId,
        actions: page.actions.map((action) => ({ ...action, id: crypto.randomUUID() })),
      }
    })
    const defaultThankYouPageId =
      thankYouPageIdMap.get(input.defaultThankYouPageId) ?? thankYouPages[0]?.id ?? ""
    return this.create(teamId, profileId, {
      ...input,
      name: `${form.name} (cópia)`,
      thankYouPages,
      defaultThankYouPageId,
      questions,
      rules: input.rules.map((rule) => ({
        ...rule,
        id: crypto.randomUUID(),
        sourceQuestionId: questionIdMap.get(rule.sourceQuestionId) ?? rule.sourceQuestionId,
        targetQuestionId:
          rule.targetQuestionId === PUBLIC_FORM_THANK_YOU_TARGET
            ? PUBLIC_FORM_THANK_YOU_TARGET
            : (questionIdMap.get(rule.targetQuestionId) ?? rule.targetQuestionId),
        targetThankYouPageId: rule.targetThankYouPageId
          ? (thankYouPageIdMap.get(rule.targetThankYouPageId) ?? rule.targetThankYouPageId)
          : null,
      })),
      scoreBands: input.scoreBands.map((band) => ({ ...band, id: crypto.randomUUID() })),
      successActions: input.successActions.map((action) => ({
        ...action,
        id: crypto.randomUUID(),
      })),
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
    const theme = resolveThemeFromDraft(draft, settings)
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
      defaultAccentColor: string
      defaultButtonTextColor: string
      defaultInputBackgroundColor: string
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

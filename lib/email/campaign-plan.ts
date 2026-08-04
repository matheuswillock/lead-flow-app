import {
  buildSubCampaignScheduledAts,
  chunkContactIdsForSubCampaigns,
  requiresSubCampaignSplit,
  type SubCampaignRecipientChunk,
} from "@/lib/email/campaign-sub-campaigns"

export type ListStrategy = "single" | "merge" | "per_list"

export type SubCampaignScheduleInput = {
  index: number
  scheduledAt: string
}

export type SubCampaignPlanItem = {
  index: number
  name: string
  totalRecipients: number
  scheduledAt?: string | null
  contactListId?: string | null
  listName?: string | null
  audienceContactIds?: string[]
}

export type CampaignPlanResult = {
  subCampaigns: SubCampaignPlanItem[]
  needsSplit: boolean
  totalRecipients: number
  listStrategy: ListStrategy
  sourceContactListIds: string[]
  isParentCampaign: boolean
}

export type ListAudienceContact = {
  contactId: string
  email: string
}

export type ListAudienceSlice = {
  listId: string
  listName: string
  contacts: ListAudienceContact[]
}

/** Contato da união lista+segmento; contactId null = veio só do segmento (ainda sem EmailContact). */
export type CombinedAudienceContact = {
  contactId: string | null
  email: string
  name?: string | null
}

/**
 * União de destinatários de listas e segmento Radar, dedupe por e-mail normalizado.
 * Prefere o contactId da lista quando o e-mail já existe nela.
 */
export function mergeListAndSegmentContacts(params: {
  listContacts: ListAudienceContact[]
  segmentRecipients: Array<{ email: string; name?: string | null }>
}): CombinedAudienceContact[] {
  const byEmail = new Map<string, CombinedAudienceContact>()

  for (const contact of params.listContacts) {
    const email = contact.email.trim().toLowerCase()
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, {
      contactId: contact.contactId,
      email,
      name: null,
    })
  }

  for (const recipient of params.segmentRecipients) {
    const email = recipient.email.trim().toLowerCase()
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, {
      contactId: null,
      email,
      name: recipient.name ?? null,
    })
  }

  return Array.from(byEmail.values())
}

/**
 * Monta plano de sub-campanhas a partir de IDs já resolvidos (merge + split).
 * Usado para audiência só-lista (merge) e para união segmento+lista materializada.
 */
export function buildCampaignPlanFromContactIds(params: {
  campaignName: string
  contactIds: string[]
  sourceContactListIds: string[]
  scheduledAt?: Date | null
  scheduleIntervalDays?: number | null
  uniformSchedule?: boolean
  subCampaignSchedules?: SubCampaignScheduleInput[]
  maxRecipientsPerSub?: number | null
  contactListId?: string | null
  listName?: string | null
}): CampaignPlanResult {
  return buildCampaignPlan({
    campaignName: params.campaignName,
    listStrategy: "merge",
    sourceContactListIds: params.sourceContactListIds,
    listAudiences: [
      {
        listId: params.contactListId ?? "combined-audience",
        listName: params.listName ?? "Audiência unificada",
        contacts: params.contactIds.map((contactId) => ({
          contactId,
          email: `${contactId}@placeholder.local`,
        })),
      },
    ],
    scheduledAt: params.scheduledAt,
    scheduleIntervalDays: params.scheduleIntervalDays,
    uniformSchedule: params.uniformSchedule,
    subCampaignSchedules: params.subCampaignSchedules,
    maxRecipientsPerSub: params.maxRecipientsPerSub,
  })
}

export function resolveListStrategy(params: {
  contactListId?: string
  contactListIds?: string[]
  listStrategy?: ListStrategy
}): ListStrategy {
  const ids = normalizeContactListIds(params)
  if (ids.length <= 1) return "single"
  return params.listStrategy === "per_list" ? "per_list" : "merge"
}

export function normalizeContactListIds(params: {
  contactListId?: string
  contactListIds?: string[]
}): string[] {
  const fromArray = (params.contactListIds ?? []).filter(Boolean)
  if (fromArray.length > 0) return Array.from(new Set(fromArray))
  if (params.contactListId) return [params.contactListId]
  return []
}

export function dedupeContactsFromSlices(slices: ListAudienceSlice[]): ListAudienceContact[] {
  const seenEmails = new Set<string>()
  const result: ListAudienceContact[] = []

  for (const slice of slices) {
    for (const contact of slice.contacts) {
      const email = contact.email.trim().toLowerCase()
      if (!email || seenEmails.has(email)) continue
      seenEmails.add(email)
      result.push({ contactId: contact.contactId, email })
    }
  }

  return result
}

function buildChunkPlans(params: {
  campaignName: string
  chunks: SubCampaignRecipientChunk[]
  contactListId?: string | null
  listName?: string | null
  scheduledAts: Array<Date | null>
}): SubCampaignPlanItem[] {
  return params.chunks.map((chunk, chunkIndex) => ({
    index: chunk.index,
    name:
      params.chunks.length > 1
        ? `${params.campaignName} (parte ${chunk.index}/${params.chunks.length})`
        : params.campaignName,
    totalRecipients: chunk.size,
    scheduledAt: params.scheduledAts[chunkIndex]?.toISOString() ?? null,
    contactListId: params.contactListId ?? null,
    listName: params.listName ?? null,
    audienceContactIds:
      params.chunks.length > 1 || params.contactListId == null
        ? chunk.contactIds
        : undefined,
  }))
}

export function buildCampaignPlan(params: {
  campaignName: string
  listStrategy: ListStrategy
  sourceContactListIds: string[]
  listAudiences: ListAudienceSlice[]
  scheduledAt?: Date | null
  scheduleIntervalDays?: number | null
  uniformSchedule?: boolean
  subCampaignSchedules?: SubCampaignScheduleInput[]
  maxRecipientsPerSub?: number | null
}): CampaignPlanResult {
  const trimmedName = params.campaignName.trim()
  const uniformSchedule = params.uniformSchedule !== false
  const maxPerSub = params.maxRecipientsPerSub

  if (params.listStrategy === "single") {
    const slice = params.listAudiences[0]
    const contactIds = slice?.contacts.map((contact) => contact.contactId) ?? []
    const totalRecipients = contactIds.length
    const needsSplit = requiresSubCampaignSplit(totalRecipients, maxPerSub)

    if (!needsSplit) {
      return {
        subCampaigns: [
          {
            index: 1,
            name: trimmedName,
            totalRecipients,
            scheduledAt: params.scheduledAt?.toISOString() ?? null,
            contactListId: slice?.listId ?? null,
            listName: slice?.listName ?? null,
          },
        ],
        needsSplit: false,
        totalRecipients,
        listStrategy: "single",
        sourceContactListIds: params.sourceContactListIds,
        isParentCampaign: false,
      }
    }

    const chunks = chunkContactIdsForSubCampaigns(contactIds, maxPerSub)
    const scheduledAts = resolveScheduledAts({
      subCount: chunks.length,
      scheduledAt: params.scheduledAt,
      scheduleIntervalDays: params.scheduleIntervalDays,
      uniformSchedule,
      subCampaignSchedules: params.subCampaignSchedules,
    })

    return {
      subCampaigns: buildChunkPlans({
        campaignName: trimmedName,
        chunks,
        contactListId: slice?.listId ?? null,
        listName: slice?.listName ?? null,
        scheduledAts,
      }),
      needsSplit: true,
      totalRecipients,
      listStrategy: "single",
      sourceContactListIds: params.sourceContactListIds,
      isParentCampaign: true,
    }
  }

  if (params.listStrategy === "merge") {
    const mergedContacts = dedupeContactsFromSlices(params.listAudiences)
    const mergedIds = mergedContacts.map((contact) => contact.contactId)
    const totalRecipients = mergedIds.length
    const needsSplit = requiresSubCampaignSplit(totalRecipients, maxPerSub)
    const chunks = needsSplit
      ? chunkContactIdsForSubCampaigns(mergedIds, maxPerSub)
      : [{ contactIds: mergedIds, size: mergedIds.length, index: 1 }]
    const scheduledAts = resolveScheduledAts({
      subCount: chunks.length,
      scheduledAt: params.scheduledAt,
      scheduleIntervalDays: params.scheduleIntervalDays,
      uniformSchedule,
      subCampaignSchedules: params.subCampaignSchedules,
    })

    return {
      subCampaigns: buildChunkPlans({
        campaignName: trimmedName,
        chunks,
        contactListId: null,
        listName: null,
        scheduledAts,
      }),
      needsSplit,
      totalRecipients,
      listStrategy: "merge",
      sourceContactListIds: params.sourceContactListIds,
      isParentCampaign: needsSplit,
    }
  }

  return buildPerListPlan({
    campaignName: trimmedName,
    listAudiences: params.listAudiences,
    scheduledAt: params.scheduledAt,
    scheduleIntervalDays: params.scheduleIntervalDays,
    uniformSchedule,
    subCampaignSchedules: params.subCampaignSchedules,
    sourceContactListIds: params.sourceContactListIds,
    maxRecipientsPerSub: maxPerSub,
  })
}

function buildPerListPlan(params: {
  campaignName: string
  listAudiences: ListAudienceSlice[]
  scheduledAt?: Date | null
  scheduleIntervalDays?: number | null
  uniformSchedule: boolean
  subCampaignSchedules?: SubCampaignScheduleInput[]
  sourceContactListIds: string[]
  maxRecipientsPerSub?: number | null
}): CampaignPlanResult {
  const subCampaigns: SubCampaignPlanItem[] = []
  let globalIndex = 0
  let totalRecipients = 0
  const maxPerSub = params.maxRecipientsPerSub

  for (const slice of params.listAudiences) {
    const contactIds = slice.contacts.map((contact) => contact.contactId)
    const chunks = requiresSubCampaignSplit(contactIds.length, maxPerSub)
      ? chunkContactIdsForSubCampaigns(contactIds, maxPerSub)
      : [{ contactIds, size: contactIds.length, index: 1 }]

    for (const chunk of chunks) {
      globalIndex += 1
      totalRecipients += chunk.size
      subCampaigns.push({
        index: globalIndex,
        name:
          chunks.length > 1
            ? `${params.campaignName} — ${slice.listName} (parte ${chunk.index}/${chunks.length})`
            : `${params.campaignName} — ${slice.listName}`,
        totalRecipients: chunk.size,
        contactListId: slice.listId,
        listName: slice.listName,
        audienceContactIds: chunks.length > 1 ? chunk.contactIds : undefined,
      })
    }
  }

  const scheduledAts = resolveScheduledAts({
    subCount: subCampaigns.length,
    scheduledAt: params.scheduledAt,
    scheduleIntervalDays: params.scheduleIntervalDays,
    uniformSchedule: params.uniformSchedule,
    subCampaignSchedules: params.subCampaignSchedules,
  })

  for (let i = 0; i < subCampaigns.length; i++) {
    subCampaigns[i] = {
      ...subCampaigns[i],
      scheduledAt: scheduledAts[i]?.toISOString() ?? null,
    }
  }

  return {
    subCampaigns,
    needsSplit: subCampaigns.length > 1,
    totalRecipients,
    listStrategy: "per_list",
    sourceContactListIds: params.sourceContactListIds,
    isParentCampaign: subCampaigns.length > 1,
  }
}

export function resolveScheduledAts(params: {
  subCount: number
  scheduledAt?: Date | null
  scheduleIntervalDays?: number | null
  uniformSchedule: boolean
  subCampaignSchedules?: SubCampaignScheduleInput[]
}): Array<Date | null> {
  if (params.subCount < 1) return []

  if (!params.uniformSchedule) {
    const byIndex = new Map(
      (params.subCampaignSchedules ?? []).map((entry) => [entry.index, new Date(entry.scheduledAt)])
    )
    return Array.from({ length: params.subCount }, (_, index) => byIndex.get(index + 1) ?? null)
  }

  if (!params.scheduledAt || !params.scheduleIntervalDays || params.scheduleIntervalDays < 1) {
    return Array.from({ length: params.subCount }, () => params.scheduledAt ?? null)
  }

  return buildSubCampaignScheduledAts(
    params.scheduledAt,
    params.subCount,
    params.scheduleIntervalDays
  )
}

export function validateCampaignPlanSchedules(
  plan: CampaignPlanResult,
  params: {
    scheduledAt?: Date | null
    scheduleIntervalDays?: number | null
    uniformSchedule?: boolean
    subCampaignSchedules?: SubCampaignScheduleInput[]
  }
): string | null {
  const needsScheduling = plan.isParentCampaign || plan.needsSplit

  if (!needsScheduling) {
    if (params.scheduledAt && params.scheduledAt <= new Date()) {
      return "Data de agendamento deve ser no futuro"
    }
    return null
  }

  const uniformSchedule = params.uniformSchedule !== false
  if (uniformSchedule) {
    if (!params.scheduledAt) {
      return "Agendamento inicial é obrigatório para campanhas com sub-campanhas"
    }
    if (params.scheduledAt <= new Date()) {
      return "Data de agendamento deve ser no futuro"
    }
    if (
      params.scheduleIntervalDays == null ||
      !Number.isInteger(params.scheduleIntervalDays) ||
      params.scheduleIntervalDays < 1
    ) {
      return "Informe o intervalo em dias (mínimo 1) entre as sub-campanhas"
    }
    return null
  }

  const schedules = params.subCampaignSchedules ?? []
  if (schedules.length !== plan.subCampaigns.length) {
    return "Informe uma data para cada sub-campanha"
  }

  for (const entry of schedules) {
    const scheduledAt = new Date(entry.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) {
      return "Data de agendamento inválida em sub-campanha"
    }
    if (scheduledAt <= new Date()) {
      return "Todas as datas de sub-campanha devem ser no futuro"
    }
  }

  return null
}
